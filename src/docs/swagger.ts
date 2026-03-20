import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Application } from 'express';
import { config } from '@/shared/config';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Student Onboarding API',
      version: '1.0.0',
      description:
        'Backend API for student admissions, fee ledger management, and academic records.',
      contact: {
        name: 'API Support',
        email: 'support@college.edu',
      },
    },
    servers: [
      {
        url: '/api/v1',
        description: config.NODE_ENV,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      responses: {
        BadRequest: { $ref: '#/components/schemas/ErrorResponse' },
        Unauthorized: { $ref: '#/components/schemas/ErrorResponse' },
        Forbidden: { $ref: '#/components/schemas/ErrorResponse' },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          required: ['success', 'message'],
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: { type: 'integer', example: 1 },
            limit: { type: 'integer', example: 20 },
            total: { type: 'integer', example: 100 },
            totalPages: { type: 'integer', example: 5 },
            hasNext: { type: 'boolean' },
            hasPrev: { type: 'boolean' },
          },
        },
        ErrorResponse: {
          type: 'object',
          required: ['success', 'message', 'code'],
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            code: { type: 'string', example: 'NOT_FOUND' },
            errors: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
        },
        ProfileResponse: {
          type: 'object',
          properties: {
            userId: { type: 'string', example: 'clxxxxxxxxxxxxxxx' },
            role: { type: 'string', enum: ['SUPER_ADMIN', 'ADMIN', 'STAFF', 'STUDENT'] },
            name: { type: 'string', example: 'Super Admin' },
            email: { type: 'string', format: 'email', example: 'superadmin@college.edu' },
            isEmailVerified: { type: 'boolean' },
            isProfileComplete: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            phone: { type: 'string', nullable: true },
            alternatePhone: { type: 'string', nullable: true },
            address: { type: 'string', nullable: true },
            city: { type: 'string', nullable: true },
            state: { type: 'string', nullable: true },
            pincode: { type: 'string', nullable: true },
            profilePhotoKey: { type: 'string', nullable: true },
            bio: { type: 'string', nullable: true },
            emergencyContact: { type: 'object', nullable: true },
            guardianName: { type: 'string', nullable: true },
            guardianPhone: { type: 'string', nullable: true },
            guardianRelation: { type: 'string', nullable: true },
            department: { type: 'string', nullable: true },
            course: { type: 'string', nullable: true },
            batch: { type: 'string', nullable: true },
            enrollmentNumber: { type: 'string', nullable: true },
            admissionDate: { type: 'string', format: 'date-time', nullable: true },
            academicYear: { type: 'string', nullable: true },
            section: { type: 'string', nullable: true },
            dateOfBirth: { type: 'string', format: 'date-time', nullable: true },
            designation: { type: 'string', nullable: true },
            employeeId: { type: 'string', nullable: true },
            joiningDate: { type: 'string', format: 'date-time', nullable: true },
            reportingTo: { type: 'string', nullable: true },
          },
        },
        UpdateProfileInput: {
          type: 'object',
          properties: {
            phone: { type: 'string' },
            alternatePhone: { type: 'string' },
            address: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            pincode: { type: 'string' },
            profilePhotoKey: { type: 'string' },
            bio: { type: 'string' },
            emergencyContact: { type: 'object' },
            guardianName: { type: 'string' },
            guardianPhone: { type: 'string' },
            guardianRelation: { type: 'string' },
          },
        },
        CreateChangeRequestInput: {
          type: 'object',
          required: ['field', 'newValue'],
          properties: {
            field: {
              type: 'string',
              enum: [
                'DEPARTMENT',
                'COURSE',
                'BATCH',
                'ENROLLMENT_NUMBER',
                'ADMISSION_DATE',
                'ACADEMIC_YEAR',
                'SECTION',
                'DATE_OF_BIRTH',
                'NAME',
                'EMAIL',
                'EMPLOYEE_ID',
                'DESIGNATION',
                'JOINING_DATE',
                'REPORTING_TO',
              ],
              description: 'The admin-controlled field to request a change for',
            },
            newValue: { type: 'string', description: 'The new value for the requested field' },
            reason: { type: 'string', description: 'Optional reason for the change request' },
          },
        },
        ChangeRequestResponse: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            field: {
              type: 'string',
              enum: [
                'DEPARTMENT',
                'COURSE',
                'BATCH',
                'ENROLLMENT_NUMBER',
                'ADMISSION_DATE',
                'ACADEMIC_YEAR',
                'SECTION',
                'DATE_OF_BIRTH',
                'NAME',
                'EMAIL',
                'EMPLOYEE_ID',
                'DESIGNATION',
                'JOINING_DATE',
                'REPORTING_TO',
              ],
            },
            oldValue: { type: 'string' },
            newValue: { type: 'string' },
            reason: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'] },
            reviewedBy: { type: 'string', nullable: true },
            reviewedAt: { type: 'string', format: 'date-time', nullable: true },
            reviewNote: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  },
  // Include controllers as well so Swagger picks up method-level JSDoc (security, params)
  apis: ['./src/routes/*.ts', './src/modules/**/*.routes.ts', './src/modules/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Mounts Swagger UI and the raw OpenAPI JSON endpoint on the Express app.
 */
export function setupSwagger(app: Application): void {
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: 'Student Onboarding API Docs',
      // Ensure persisted auth and include request options to send cookies (withCredentials)
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        // Include cookies in requests (so httpOnly refresh cookies will be sent if present)
        requestInterceptor: (req: unknown) => {
          // `credentials = 'include'` instructs the browser to include cookies for same-origin
          // requests made by the Swagger UI client.
          (req as { credentials?: string }).credentials = 'include';
          return req;
        },
      },
    }),
  );

  app.get('/api/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
