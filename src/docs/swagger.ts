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
