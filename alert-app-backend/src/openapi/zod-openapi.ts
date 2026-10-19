import {
  adminUserListSchema,
  adminUserSchema,
  updateAdminUserRequestSchema,
} from '@alert-app/shared';
import { applyDecorators } from '@nestjs/common';
import { ApiQuery, type OpenAPIObject } from '@nestjs/swagger';
import { z } from 'zod';

/** One schema in the OpenAPI document (@nestjs/swagger doesn't export this type directly). */
type SchemaObject = NonNullable<NonNullable<OpenAPIObject['components']>['schemas']>[string];

// The shared Zod schemas are the single source of truth for request and response shapes:
// the backend validates with them (parseBody), and here they become the OpenAPI schemas
// that Swagger shows and Orval turns into frontend types. No DTO classes that repeat the fields.

/** Shared schemas used in the API, by their OpenAPI name. Add new ones here. */
const apiSchemas = {
  AdminUser: adminUserSchema,
  AdminUserList: adminUserListSchema,
  UpdateAdminUserRequest: updateAdminUserRequestSchema,
} satisfies Record<string, z.ZodType>;

export type ApiSchemaName = keyof typeof apiSchemas;

const toOpenApi = { target: 'openapi-3.0' } as const;

/**
 * A reference to one of the schemas above, for @ApiOkResponse, @ApiBody, ...
 * @example @ApiOkResponse({ schema: schemaRef('AdminUser') })
 */
export function schemaRef(name: ApiSchemaName) {
  return { $ref: `#/components/schemas/${name}` };
}

/** Adds the schemas above to the OpenAPI document (under components.schemas). */
export function addApiSchemas(document: OpenAPIObject): OpenAPIObject {
  // A registry turns a schema used inside another one (AdminUser inside AdminUserList)
  // into a $ref instead of a copy, so Orval generates one named type for it.
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries(apiSchemas)) registry.add(schema, { id });

  const { schemas } = z.toJSONSchema(registry, {
    ...toOpenApi,
    uri: (id) => `#/components/schemas/${id}`,
  });
  const components = Object.fromEntries(
    // $id is JSON Schema, not OpenAPI: leave it out
    Object.entries(schemas).map(([name, schema]) => {
      const openApiSchema = { ...schema };
      delete openApiSchema.$id;
      return [name, openApiSchema as SchemaObject];
    }),
  );

  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...components },
  };
  return document;
}

/**
 * Documents every field of a Zod object as a query parameter.
 * @example @ApiQueryFromZod(adminUserListQuerySchema)
 */
export function ApiQueryFromZod(schema: z.ZodObject) {
  // io: 'input' = what the client sends (fields with a default are optional)
  const { properties = {}, required = [] } = z.toJSONSchema(schema, { ...toOpenApi, io: 'input' });

  return applyDecorators(
    ...Object.entries(properties).map(([name, property]) =>
      ApiQuery({ name, required: required.includes(name), schema: property as SchemaObject }),
    ),
  );
}
