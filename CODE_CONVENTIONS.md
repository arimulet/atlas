# Convenciones de Código

Este documento define las normas de desarrollo para el repositorio Fullstack basado en
Node.js, TypeScript, React y Vitest. Su objetivo es mantener una base de código consistente,
legible, testeable y escalable.

Estas reglas aplican a aplicaciones, paquetes compartidos, scripts internos y tests del
monorepo.

## 1. Estructura de Proyecto y Archivos

### Arquitectura orientada a Features

El proyecto debe organizarse priorizando la intención funcional del sistema antes que el tipo
técnico del archivo. Esta aproximación se conoce como **Screaming Architecture**: al mirar la
estructura de carpetas, debe ser evidente qué hace el producto.

En lugar de agrupar todo por capas globales:

```txt
src/
  components/
  hooks/
  services/
  utils/
```

preferimos agrupar por dominio o feature:

```txt
src/
  features/
    auth/
    projects/
    billing/
```

Cada feature debe contener su UI, hooks, servicios, tipos y tests cuando esos elementos sean
propios de esa feature. El código reutilizable entre features vive en `src/shared`.

### Árbol de carpetas recomendado

```txt
.
├── apps/
│   ├── web/
│   │   └── src/
│   │       ├── app/
│   │       │   ├── App.tsx
│   │       │   ├── router.tsx
│   │       │   └── providers.tsx
│   │       ├── features/
│   │       │   ├── auth/
│   │       │   │   ├── components/
│   │       │   │   │   └── LoginForm.tsx
│   │       │   │   ├── hooks/
│   │       │   │   │   └── useLogin.ts
│   │       │   │   ├── services/
│   │       │   │   │   └── auth-api.ts
│   │       │   │   ├── schemas/
│   │       │   │   │   └── login-schema.ts
│   │       │   │   ├── types/
│   │       │   │   │   └── auth.types.ts
│   │       │   │   └── __tests__/
│   │       │   │       ├── LoginForm.test.tsx
│   │       │   │       └── useLogin.test.ts
│   │       │   └── projects/
│   │       ├── shared/
│   │       │   ├── components/
│   │       │   ├── hooks/
│   │       │   ├── lib/
│   │       │   ├── services/
│   │       │   ├── types/
│   │       │   └── utils/
│   │       ├── assets/
│   │       │   ├── images/
│   │       │   ├── icons/
│   │       │   └── styles/
│   │       └── main.tsx
│   └── api/
│       └── src/
│           ├── app.ts
│           ├── server.ts
│           ├── features/
│           │   └── users/
│           │       ├── users.controller.ts
│           │       ├── users.service.ts
│           │       ├── users.repository.ts
│           │       ├── users.schema.ts
│           │       ├── users.types.ts
│           │       └── __tests__/
│           │           └── users.service.test.ts
│           └── shared/
│               ├── config/
│               ├── errors/
│               ├── http/
│               ├── middleware/
│               └── utils/
├── packages/
│   ├── contracts/
│   ├── domain/
│   ├── application/
│   └── database/
├── e2e/
├── scripts/
├── eslint.config.js
├── prettier.config.js
├── tsconfig.base.json
└── vitest.config.ts
```

### Nomenclatura de archivos

| Tipo de archivo | Convención | Ejemplo |
| --- | --- | --- |
| Componentes React | `PascalCase.tsx` | `UserProfileCard.tsx` |
| Hooks React | `use` + `camelCase.ts` | `useCurrentUser.ts` |
| Servicios Node/TS | `kebab-case.ts` | `payment-service.ts` |
| Utilidades | `kebab-case.ts` | `format-currency.ts` |
| Schemas | `kebab-case.ts` o feature scoped | `create-user-schema.ts`, `users.schema.ts` |
| Types compartidos | `kebab-case.types.ts` | `user.types.ts` |
| Tests React | `.test.tsx` | `LoginForm.test.tsx` |
| Tests TypeScript | `.test.ts` | `create-user.test.ts` |

Evitar nombres genéricos como `helpers.ts`, `utils.ts`, `types.ts` o `service.ts` cuando no
describan claramente su responsabilidad.

```ts
// Bien
export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency
  }).format(value);
}

// Mal
export function format(value: number): string {
  return String(value);
}
```

## 2. Convenciones de Nomenclatura

| Elemento | Convención | Ejemplo |
| --- | --- | --- |
| Variables | `camelCase`, nombre descriptivo | `currentUser`, `invoiceTotal` |
| Funciones | `camelCase`, verbo + objeto | `calculateTotal`, `createSession` |
| Componentes React | `PascalCase` | `ProjectList`, `LoginForm` |
| Interfaces | `PascalCase`, sin prefijo `I` | `UserRepository`, `LoginFormProps` |
| Types | `PascalCase` | `UserRole`, `ApiResponse<T>` |
| Constantes globales | `UPPER_SNAKE_CASE` | `DEFAULT_PAGE_SIZE` |
| Enums | `PascalCase` para enum y miembros | `UserStatus.Active` |
| Booleanos | Prefijos `is`, `has`, `can`, `should` | `isLoading`, `hasAccess`, `shouldRetry` |
| Event handlers internos | Prefijo `handle` | `handleSubmit`, `handleClick` |
| Props callback | Prefijo `on` | `onSubmit`, `onClose` |

```tsx
interface SaveButtonProps {
  isLoading: boolean;
  onSave: () => void;
}

export function SaveButton({ isLoading, onSave }: SaveButtonProps) {
  const handleClick = () => {
    if (isLoading) {
      return;
    }

    onSave();
  };

  return (
    <button type="button" disabled={isLoading} onClick={handleClick}>
      Guardar
    </button>
  );
}
```

## 3. Best Practices de TypeScript

### `strict: true` obligatorio

Todo paquete TypeScript debe compilar con `strict: true`. Esta regla reduce errores en runtime y
obliga a modelar correctamente los contratos.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Prohibición de `any`

El uso de `any` queda prohibido salvo excepciones justificadas en migraciones controladas y con
comentario explícito. Si el tipo no se conoce, usar `unknown` y estrecharlo mediante Type Guards,
schemas o validación explícita.

```ts
// Mal
function parsePayload(payload: any) {
  return payload.userId;
}

// Bien
function isUserPayload(value: unknown): value is { userId: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "userId" in value &&
    typeof value.userId === "string"
  );
}

function parsePayload(payload: unknown): string {
  if (!isUserPayload(payload)) {
    throw new Error("Invalid user payload");
  }

  return payload.userId;
}
```

### `interface` vs `type`

Usar `interface` para describir la forma de objetos, props, contratos de clases o contratos de
servicios.

```ts
export interface UserRepository {
  findById(userId: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export interface UserProfileProps {
  user: User;
  onEdit: () => void;
}
```

Usar `type` para uniones, aliases, tipos derivados, generics utilitarios y composiciones.

```ts
export type UserRole = "admin" | "member" | "viewer";

export type ApiResult<TData> =
  | { status: "success"; data: TData }
  | { status: "error"; message: string };

export type UserSummary = Pick<User, "id" | "name" | "email">;
```

### Preferir tipos explícitos en bordes del sistema

Las funciones públicas, servicios, repositorios, controllers y hooks exportados deben declarar
tipos de entrada y salida.

```ts
export async function getUserById(userId: string): Promise<User | null> {
  return userRepository.findById(userId);
}
```

## 4. Convenciones de React & Frontend

### Componentes funcionales y exports nombrados

Todos los componentes React deben escribirse como funciones y exportarse de forma nombrada.
Evitar `default export`, porque dificulta refactors, autocompletado y consistencia de imports.

```tsx
interface UserAvatarProps {
  name: string;
  imageUrl?: string;
}

export function UserAvatar({ name, imageUrl }: UserAvatarProps) {
  if (imageUrl) {
    return <img src={imageUrl} alt={name} />;
  }

  return <span aria-label={name}>{name.charAt(0).toUpperCase()}</span>;
}
```

```tsx
// Mal
export default function UserAvatar() {
  return null;
}
```

### Tamaño y responsabilidad de componentes

Un componente no debe superar aproximadamente **150-200 líneas**. Si crece más, revisar si está
mezclando responsabilidades:

- UI visual.
- Estado local complejo.
- Acceso a datos remotos.
- Transformaciones de datos.
- Validaciones.
- Side effects.

Mover lógica reutilizable o compleja a Custom Hooks.

```tsx
export function ProjectPage() {
  const { projects, isLoading, createProject } = useProjects();

  if (isLoading) {
    return <ProjectListSkeleton />;
  }

  return <ProjectList projects={projects} onCreateProject={createProject} />;
}
```

```ts
export function useProjects() {
  const projectsQuery = useProjectsQuery();
  const createProjectMutation = useCreateProjectMutation();

  return {
    projects: projectsQuery.data ?? [],
    isLoading: projectsQuery.isLoading,
    createProject: createProjectMutation.mutate
  };
}
```

### Estado local vs Server State

Usar estado local (`useState`, `useReducer`) para estado puramente visual o temporal:

- Modal abierto/cerrado.
- Valor de un input no enviado.
- Tab seleccionada.
- Estado de hover, filtros locales o toggles visuales.

```tsx
export function ProjectFilters() {
  const [searchText, setSearchText] = useState("");

  return (
    <input
      type="search"
      value={searchText}
      onChange={(event) => setSearchText(event.target.value)}
    />
  );
}
```

Usar herramientas de Server State como **TanStack Query** o **RTK Query** para datos remotos,
cache, revalidación, estados de carga, errores y mutaciones.

```ts
export function useCurrentUserQuery() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser
  });
}
```

No duplicar Server State en `useState` salvo que exista una razón clara, como edición optimista o
formularios desacoplados.

## 5. Convenciones de Node.js & Backend

### Arquitectura en capas

El backend debe separar responsabilidades usando el flujo:

```txt
Controller -> Service -> Repository
```

- **Controller**: traduce HTTP a casos de uso. Lee request, valida entrada, define status code y
  respuesta.
- **Service**: contiene reglas de negocio y orquesta dependencias.
- **Repository**: encapsula persistencia y consultas a base de datos.

```ts
// users.controller.ts
export async function createUserController(request: Request, response: Response): Promise<void> {
  const payload = createUserSchema.parse(request.body);
  const user = await createUser(payload);

  response.status(201).json(user);
}
```

```ts
// users.service.ts
export async function createUser(input: CreateUserInput): Promise<User> {
  const existingUser = await usersRepository.findByEmail(input.email);

  if (existingUser) {
    throw new ConflictError("User email already exists");
  }

  return usersRepository.create(input);
}
```

```ts
// users.repository.ts
export async function findByEmail(email: string): Promise<User | null> {
  return database.users.findUnique({
    where: { email }
  });
}
```

### Manejo asíncrono

Usar `async/await` para código asíncrono. Evitar mezclar `.then()` y `.catch()` dentro de flujos
de aplicación salvo en adaptadores muy puntuales.

Los errores deben centralizarse en middleware. Los controllers no deben repetir bloques
`try/catch` si existe un wrapper o middleware de manejo de errores.

```ts
type AsyncController = (request: Request, response: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(controller: AsyncController) {
  return (request: Request, response: Response, next: NextFunction) => {
    void controller(request, response, next).catch(next);
  };
}
```

```ts
router.post("/users", asyncHandler(createUserController));
```

```ts
export function errorMiddleware(
  error: unknown,
  request: Request,
  response: Response,
  next: NextFunction
): void {
  if (error instanceof AppError) {
    response.status(error.statusCode).json({ message: error.message });
    return;
  }

  response.status(500).json({ message: "Internal server error" });
}
```

### Validación con Zod

Todo payload externo debe validarse con schemas antes de llegar a la lógica de negocio:

- `request.body`.
- `request.params`.
- `request.query`.
- Variables de entorno.
- Webhooks.
- Mensajes de colas o eventos.

```ts
import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(12)
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

```ts
export async function createUserController(request: Request, response: Response): Promise<void> {
  const input = createUserSchema.parse(request.body);
  const user = await createUser(input);

  response.status(201).json(user);
}
```

## 6. Convenciones de Tests Automatizados con Vitest

### Ubicación de tests

Los tests deben vivir en carpetas colindantes `__tests__` dentro de la feature, módulo o carpeta
que están verificando.

```txt
src/features/auth/
  components/
    LoginForm.tsx
  hooks/
    useLogin.ts
  __tests__/
    LoginForm.test.tsx
    useLogin.test.ts
```

Usar extensiones:

- `.test.ts` para lógica TypeScript.
- `.test.tsx` para componentes React.

### Estructura AAA

Los tests deben seguir el patrón **Arrange, Act, Assert** y separar visualmente cada fase con una
línea en blanco.

```ts
import { describe, expect, it } from "vitest";

import { calculateInvoiceTotal } from "../calculate-invoice-total";

describe("calculateInvoiceTotal", () => {
  it("returns the sum of item prices plus taxes", () => {
    const items = [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 }
    ];
    const taxRate = 0.21;

    const total = calculateInvoiceTotal(items, taxRate);

    expect(total).toBe(302.5);
  });
});
```

### React Testing Library

Priorizar queries que reflejen cómo una persona usa la interfaz:

1. `getByRole`
2. `getByLabelText`
3. `getByPlaceholderText`
4. `getByText`
5. `getByDisplayValue`
6. `getByAltText`
7. `getByTitle`
8. `getByTestId` solo como último recurso

Evitar selectores CSS y `data-testid` cuando exista una query accesible.

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "../components/LoginForm";

describe("LoginForm", () => {
  it("submits the user credentials", async () => {
    const user = userEvent.setup();
    const mockSubmit = vi.fn();

    render(<LoginForm onSubmit={mockSubmit} />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "super-secret-password");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(mockSubmit).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "super-secret-password"
    });
  });
});
```

### Reglas de mocks

Los mocks deben usar prefijo `mock` para distinguirlos de implementaciones reales.

```ts
const mockUsersRepository = {
  findByEmail: vi.fn(),
  create: vi.fn()
};
```

Limpiar mocks entre tests. Preferir configuración global en Vitest cuando sea posible.

```ts
import { afterEach, vi } from "vitest";

afterEach(() => {
  vi.clearAllMocks();
});
```

Para peticiones HTTP, preferir **MSW (Mock Service Worker)** sobre mocks manuales de `fetch` o
clientes HTTP. MSW permite testear el comportamiento real del código de red sin acoplar el test a
detalles internos.

```ts
import { http, HttpResponse } from "msw";

export const handlers = [
  http.get("/api/users/me", () => {
    return HttpResponse.json({
      id: "user_123",
      name: "Ada Lovelace"
    });
  })
];
```

## 7. Herramientas y Control de Calidad

### ESLint

ESLint es obligatorio para detectar problemas de calidad, errores comunes y violaciones de reglas
TypeScript. Todo PR debe pasar:

```bash
npm run lint
```

Reglas esperadas:

- No usar `any`.
- No declarar variables sin uso.
- No ignorar promesas accidentalmente.
- Mantener imports consistentes.
- Respetar reglas de React Hooks en aplicaciones React.

### Prettier

Prettier define el formato del código. No se debe debatir formato en code review; cualquier
diferencia debe resolverse ejecutando:

```bash
npm run format
```

Configuración base del repositorio:

```js
export default {
  printWidth: 100,
  semi: true,
  singleQuote: false,
  trailingComma: "none"
};
```

### Husky + lint-staged

Se recomienda usar Husky y lint-staged para ejecutar validaciones antes de cada commit.

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css,scss}": ["prettier --write"]
  }
}
```

Hook recomendado:

```bash
npm run lint
npm run test
```

### Conventional Commits

Los commits deben seguir **Conventional Commits** para facilitar changelogs, versionado y revisión
histórica.

Formato:

```txt
<type>(scope): <description>
```

Tipos comunes:

- `feat`: nueva funcionalidad.
- `fix`: corrección de bug.
- `docs`: documentación.
- `test`: tests nuevos o modificados.
- `refactor`: cambio interno sin alterar comportamiento.
- `chore`: tareas de mantenimiento.
- `build`: cambios de build, dependencias o tooling.
- `ci`: cambios de integración continua.

Ejemplos:

```txt
feat(auth): add refresh token rotation
fix(api): handle missing user session
docs(conventions): add testing guidelines
test(projects): cover project creation service
```

### Checklist mínimo antes de abrir un PR

- El código compila con TypeScript en modo estricto.
- `npm run lint` pasa sin errores.
- `npm run test` pasa sin errores.
- Las features nuevas incluyen tests relevantes.
- No se introducen `any`, exports default innecesarios ni archivos genéricos ambiguos.
- Los payloads externos del backend están validados con Zod.
- Los componentes React son accesibles y testeables con queries semánticas.
