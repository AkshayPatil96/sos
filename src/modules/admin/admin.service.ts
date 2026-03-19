import {
  UserRole,
  UserStatus,
  ChangeRequestStatus,
  ChangeRequestField,
} from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import type { IEmailService } from '@/lib/email';
import { writeAuditLog } from '@/shared/utils/auditLog';
import { Errors } from '@/shared/utils/AppError';
import { generateSecureToken, hashToken } from '@/shared/utils/token';
import { config } from '@/shared/config';
import { parsePaginationQuery, buildPagination } from '@/shared/utils/pagination';
import type { Pagination } from '@/shared/utils/response';
import type { IAdminRepository } from './admin.repository';
import type {
  CreateUserInput,
  UpdateUserStatusInput,
  UpdateUserRoleInput,
  UpdateUserProfileInput,
  ReviewProfileChangeInput,
  ListUsersQuery,
  ListAuditLogsQuery,
  ListProfileChangesQuery,
  UserDetailDTO,
  UserListItemDTO,
  AuditLogDTO,
  ProfileChangeRequestDTO,
} from './admin.types';
import { AdminMapper } from './admin.mapper';

/** Roles that are protected — only SUPER_ADMIN can target these users */
const PROTECTED_ROLES: ReadonlySet<UserRole> = new Set([UserRole.SUPER_ADMIN, UserRole.ADMIN]);

/** Roles that ADMIN is allowed to assign */
const ADMIN_ASSIGNABLE_ROLES: ReadonlySet<UserRole> = new Set([UserRole.STAFF, UserRole.STUDENT]);

/** Request meta for audit logging */
export interface RequestMeta {
  ip: string;
  userAgent: string;
}

/** Actor context for service calls */
export interface ActorContext {
  id: string;
  role: UserRole;
}

export class AdminService {
  constructor(
    private readonly repo: IAdminRepository,
    private readonly emailSvc: IEmailService,
  ) {}

  /**
   * Enforces role hierarchy: ADMIN cannot create/modify users with protected roles.
   */
  private assertHierarchyAllowed(actor: ActorContext, targetRole: UserRole): void {
    if (actor.role === UserRole.ADMIN && PROTECTED_ROLES.has(targetRole)) {
      throw Errors.forbidden('ADMIN cannot manage ADMIN or SUPER_ADMIN accounts');
    }
  }

  /**
   * Enforces which roles ADMIN can assign. SUPER_ADMIN can assign any role.
   */
  private assertRoleAssignmentAllowed(actor: ActorContext, newRole: UserRole): void {
    if (actor.role === UserRole.ADMIN && !ADMIN_ASSIGNABLE_ROLES.has(newRole)) {
      throw Errors.forbidden('ADMIN can only assign STAFF or STUDENT roles');
    }
  }

  /**
   * Creates a new user account, sends a verification email, and writes an audit log.
   *
   * SUPER_ADMIN can create any role. ADMIN can only create STAFF/STUDENT.
   * In development mode, skips the actual email send and returns token data instead.
   */
  async createUser(
    input: CreateUserInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<{ user: UserDetailDTO; verifyToken?: string; verifyUrl?: string }> {
    this.assertHierarchyAllowed(actor, input.role);
    this.assertRoleAssignmentAllowed(actor, input.role);

    const user = await this.repo.createUser({
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      createdById: actor.id,
    });

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000);
    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${rawToken}`;

    await prisma.$transaction(async (tx) => {
      await this.repo.deleteEmailVerificationTokensForUser(user.id, tx);
      await this.repo.createEmailVerificationToken({ userId: user.id, tokenHash, expiresAt }, tx);
    });

    if (config.NODE_ENV !== 'development') {
      try {
        await this.emailSvc.sendEmailVerificationEmail(user.email, user.name, verifyUrl);
      } catch {
        void writeAuditLog({
          userId: actor.id,
          action: 'ADMIN_CREATE_USER_FAILED',
          entity: 'User',
          entityId: user.id,
          severity: 'high',
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        throw Errors.serviceUnavailable(
          'Unable to send verification email. Please try again later.',
        );
      }
    }

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_CREATE_USER',
      entity: 'User',
      entityId: user.id,
      severity: 'medium',
      after: { id: user.id, email: user.email, role: user.role },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    const created = await this.repo.findUserById(user.id);
    if (!created) throw Errors.notFound('User', user.id);

    const response: { user: UserDetailDTO; verifyToken?: string; verifyUrl?: string } = {
      user: AdminMapper.toUserDetailDTO(created),
    };

    if (config.NODE_ENV === 'development') {
      response.verifyToken = rawToken;
      response.verifyUrl = verifyUrl;
    }

    return response;
  }

  /**
   * Returns a paginated list of users with optional filters.
   */
  async listUsers(
    query: ListUsersQuery,
    _actor: ActorContext,
  ): Promise<{ data: UserListItemDTO[]; pagination: Pagination }> {
    const { page, limit, skip } = parsePaginationQuery(query);
    const role = query.role as UserRole | undefined;
    const status = query.status as UserStatus | undefined;

    const { users, total } = await this.repo.findUsers({
      role,
      status,
      search: query.search,
      skip,
      take: limit,
    });

    return {
      data: AdminMapper.toUserListItemDTOList(users),
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Returns a single user with full profile details.
   */
  async getUserById(userId: string, _actor: ActorContext): Promise<UserDetailDTO> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User', userId);
    return AdminMapper.toUserDetailDTO(user);
  }

  /**
   * Updates a user's active/inactive/suspended status.
   * Setting INACTIVE atomically deletes all refresh tokens (force re-login).
   */
  async updateUserStatus(
    userId: string,
    input: UpdateUserStatusInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<void> {
    const target = await this.repo.findUserById(userId);
    if (!target) throw Errors.notFound('User', userId);

    this.assertHierarchyAllowed(actor, target.role);

    const before = { status: target.status };
    const after = { status: input.status };

    if (input.status === UserStatus.INACTIVE) {
      await prisma.$transaction(async (tx) => {
        await this.repo.updateUserStatus(userId, input.status, tx);
        await this.repo.deleteAllRefreshTokens(userId, tx);
      });
    } else {
      await this.repo.updateUserStatus(userId, input.status);
    }

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_UPDATE_USER_STATUS',
      entity: 'User',
      entityId: userId,
      severity: 'medium',
      before,
      after,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Changes a user's role. Deletes all refresh tokens (force re-login with new role claims).
   * Creates the appropriate profile record if one doesn't exist yet.
   */
  async updateUserRole(
    userId: string,
    input: UpdateUserRoleInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<void> {
    const target = await this.repo.findUserById(userId);
    if (!target) throw Errors.notFound('User', userId);

    this.assertHierarchyAllowed(actor, target.role);
    this.assertHierarchyAllowed(actor, input.role);
    this.assertRoleAssignmentAllowed(actor, input.role);

    if (target.role === input.role) {
      throw Errors.badRequest('User already has this role');
    }

    const before = { role: target.role };
    const after = { role: input.role };

    await prisma.$transaction(async (tx) => {
      await this.repo.updateUserRole(userId, input.role, tx);
      await this.repo.deleteAllRefreshTokens(userId, tx);

      // Ensure corresponding profile record exists for the new role
      if (input.role === UserRole.ADMIN && !target.adminProfile) {
        await this.repo.upsertAdminProfile(userId, {}, tx);
      } else if (input.role === UserRole.STAFF && !target.staffProfile) {
        await this.repo.upsertStaffProfile(userId, {}, tx);
      } else if (input.role === UserRole.STUDENT && !target.studentProfile) {
        await this.repo.upsertStudentProfile(userId, {}, tx);
      }
    });

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_UPDATE_USER_ROLE',
      entity: 'User',
      entityId: userId,
      severity: 'high',
      before,
      after,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Updates the admin-controlled fields on the profile matching the user's role.
   */
  async updateUserProfile(
    userId: string,
    input: UpdateUserProfileInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<void> {
    const target = await this.repo.findUserById(userId);
    if (!target) throw Errors.notFound('User', userId);

    this.assertHierarchyAllowed(actor, target.role);

    await prisma.$transaction(async (tx) => {
      if (target.role === UserRole.ADMIN) {
        await this.repo.upsertAdminProfile(
          userId,
          {
            department: input.department,
            employeeId: input.employeeId,
            joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
          },
          tx,
        );
      } else if (target.role === UserRole.STAFF) {
        await this.repo.upsertStaffProfile(
          userId,
          {
            department: input.department,
            designation: input.designation,
            employeeId: input.employeeId,
            joiningDate: input.joiningDate ? new Date(input.joiningDate) : undefined,
            reportingTo: input.reportingTo,
          },
          tx,
        );
      } else if (target.role === UserRole.STUDENT) {
        await this.repo.upsertStudentProfile(
          userId,
          {
            course: input.course,
            batch: input.batch,
            enrollmentNumber: input.enrollmentNumber,
            admissionDate: input.admissionDate ? new Date(input.admissionDate) : undefined,
            academicYear: input.academicYear,
            section: input.section,
            department: input.department,
          },
          tx,
        );
      } else {
        throw Errors.badRequest('Profile fields cannot be set for this role');
      }
    });

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_UPDATE_USER_PROFILE',
      entity: 'User',
      entityId: userId,
      severity: 'low',
      after: input as Record<string, unknown>,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Returns a paginated list of audit log entries.
   */
  async listAuditLogs(
    query: ListAuditLogsQuery,
    _actor: ActorContext,
  ): Promise<{ data: AuditLogDTO[]; pagination: Pagination }> {
    const { page, limit, skip } = parsePaginationQuery(query);

    type AllowedSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    const severityMap: Record<string, AllowedSeverity> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
    };
    const severity = query.severity
      ? (severityMap[query.severity.toUpperCase()] ?? undefined)
      : undefined;

    const { logs, total } = await this.repo.findAuditLogs({
      userId: query.userId,
      action: query.action,
      entity: query.entity,
      severity: severity as Parameters<IAdminRepository['findAuditLogs']>[0]['severity'],
      skip,
      take: limit,
    });

    return {
      data: AdminMapper.toAuditLogDTOList(logs),
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Returns a paginated list of profile change requests.
   */
  async listProfileChangeRequests(
    query: ListProfileChangesQuery,
    _actor: ActorContext,
  ): Promise<{ data: ProfileChangeRequestDTO[]; pagination: Pagination }> {
    const { page, limit, skip } = parsePaginationQuery(query);

    const { requests, total } = await this.repo.findProfileChangeRequests({
      userId: query.userId,
      status: query.status as ChangeRequestStatus | undefined,
      field: query.field as ChangeRequestField | undefined,
      skip,
      take: limit,
    });

    return {
      data: AdminMapper.toProfileChangeRequestDTOList(requests),
      pagination: buildPagination(page, limit, total),
    };
  }

  /**
   * Approves a profile change request and applies the new value atomically.
   * Enforces that the reviewer cannot approve changes for users with protected roles
   * unless they are a SUPER_ADMIN.
   */
  async approveProfileChange(
    requestId: string,
    input: ReviewProfileChangeInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<void> {
    const request = await this.repo.findProfileChangeRequestById(requestId);
    if (!request) throw Errors.notFound('ProfileChangeRequest', requestId);

    if (request.status !== ChangeRequestStatus.PENDING) {
      throw Errors.badRequest('Only PENDING requests can be approved');
    }

    // Prevent ADMIN from approving SUPER_ADMIN or ADMIN profile changes
    const targetUser = await this.repo.findUserById(request.userId);
    if (!targetUser) throw Errors.notFound('User', request.userId);
    this.assertHierarchyAllowed(actor, targetUser.role);

    await prisma.$transaction(async (tx) => {
      await this.repo.updateProfileChangeStatus(
        requestId,
        ChangeRequestStatus.APPROVED,
        actor.id,
        input.reviewNote,
        tx,
      );

      switch (request.field) {
        case ChangeRequestField.NAME:
          await this.repo.applyNameChange(request.userId, request.newValue, tx);
          break;
        case ChangeRequestField.EMAIL:
          await this.repo.applyEmailChange(request.userId, request.newValue, tx);
          break;
        case ChangeRequestField.ENROLLMENT_NUMBER:
          await this.repo.applyStudentProfileFieldChange(
            request.userId,
            'enrollmentNumber',
            request.newValue,
            tx,
          );
          break;
        case ChangeRequestField.DATE_OF_BIRTH:
          await this.repo.applyStudentProfileFieldChange(
            request.userId,
            'dateOfBirth',
            request.newValue,
            tx,
          );
          break;
        case ChangeRequestField.EMPLOYEE_ID: {
          // targetUser already fetched above for hierarchy check
          if (targetUser.role === UserRole.ADMIN) {
            await this.repo.applyAdminProfileFieldChange(
              request.userId,
              'employeeId',
              request.newValue,
              tx,
            );
          } else {
            await this.repo.applyStaffProfileFieldChange(
              request.userId,
              'employeeId',
              request.newValue,
              tx,
            );
          }
          break;
        }
        default:
          throw Errors.badRequest(`Unsupported change request field: ${request.field}`);
      }
    });

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_APPROVE_PROFILE_CHANGE',
      entity: 'ProfileChangeRequest',
      entityId: requestId,
      severity: 'medium',
      after: { field: request.field, newValue: request.newValue },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Rejects a profile change request with an optional review note.
   */
  async rejectProfileChange(
    requestId: string,
    input: ReviewProfileChangeInput,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<void> {
    const request = await this.repo.findProfileChangeRequestById(requestId);
    if (!request) throw Errors.notFound('ProfileChangeRequest', requestId);

    if (request.status !== ChangeRequestStatus.PENDING) {
      throw Errors.badRequest('Only PENDING requests can be rejected');
    }

    await this.repo.updateProfileChangeStatus(
      requestId,
      ChangeRequestStatus.REJECTED,
      actor.id,
      input.reviewNote,
    );

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_REJECT_PROFILE_CHANGE',
      entity: 'ProfileChangeRequest',
      entityId: requestId,
      severity: 'low',
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });
  }

  /**
   * Resends a new email verification link to an unverified user.
   * Deletes any existing verification tokens and creates a fresh one.
   * In development, skips the actual email send and returns token data instead.
   */
  async resendVerificationEmail(
    userId: string,
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<{ verifyToken?: string; verifyUrl?: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User', userId);

    if (user.isEmailVerified) {
      throw Errors.badRequest('User email is already verified');
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000);
    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${rawToken}`;

    await prisma.$transaction(async (tx) => {
      await this.repo.deleteEmailVerificationTokensForUser(userId, tx);
      await this.repo.createEmailVerificationToken({ userId, tokenHash, expiresAt }, tx);
    });

    if (config.NODE_ENV !== 'development') {
      try {
        await this.emailSvc.sendEmailVerificationEmail(user.email, user.name, verifyUrl);
      } catch {
        void writeAuditLog({
          userId: actor.id,
          action: 'ADMIN_RESEND_VERIFICATION_FAILED',
          entity: 'User',
          entityId: userId,
          severity: 'high',
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        throw Errors.serviceUnavailable(
          'Unable to send verification email. Please try again later.',
        );
      }
    }

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_RESEND_VERIFICATION_EMAIL',
      entity: 'User',
      entityId: userId,
      severity: 'medium',
      after: { email: user.email },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    if (config.NODE_ENV === 'development') {
      return { verifyToken: rawToken, verifyUrl };
    }
    return {};
  }

  /**
   * Corrects a user's email address.
   * Sets isEmailVerified=false, deletes old verification tokens, creates a new token,
   * and sends a fresh verification email. Also writes an audit log.
   * In development, skips the actual email send and returns token data instead.
   */
  async correctUserEmail(
    userId: string,
    input: { email: string },
    actor: ActorContext,
    meta: RequestMeta,
  ): Promise<{ verifyToken?: string; verifyUrl?: string }> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw Errors.notFound('User', userId);

    const normalizedEmail = input.email.toLowerCase();

    // Check email uniqueness (excluding the current user)
    const existing = await this.repo.findUserByEmail(normalizedEmail);
    if (existing && existing.id !== userId) {
      throw Errors.conflict('Email address is already in use');
    }

    const before = { email: user.email };

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + config.EMAIL_VERIFY_EXPIRES_HOURS * 60 * 60 * 1000);
    const verifyUrl = `${config.FRONTEND_URL}/auth/verify-email?token=${rawToken}`;

    await prisma.$transaction(async (tx) => {
      await this.repo.updateUserEmail(userId, normalizedEmail, tx);
      await this.repo.deleteEmailVerificationTokensForUser(userId, tx);
      await this.repo.createEmailVerificationToken({ userId, tokenHash, expiresAt }, tx);
    });

    if (config.NODE_ENV !== 'development') {
      try {
        await this.emailSvc.sendEmailVerificationEmail(normalizedEmail, user.name, verifyUrl);
      } catch {
        void writeAuditLog({
          userId: actor.id,
          action: 'ADMIN_CORRECT_EMAIL_FAILED',
          entity: 'User',
          entityId: userId,
          severity: 'high',
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        throw Errors.serviceUnavailable(
          'Unable to send verification email. Please try again later.',
        );
      }
    }

    void writeAuditLog({
      userId: actor.id,
      action: 'ADMIN_CORRECT_USER_EMAIL',
      entity: 'User',
      entityId: userId,
      severity: 'medium',
      before,
      after: { email: normalizedEmail },
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    });

    if (config.NODE_ENV === 'development') {
      return { verifyToken: rawToken, verifyUrl };
    }
    return {};
  }
}
