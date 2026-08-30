# 📘 Documentación Técnica y Arquitectura del Ecosistema Cenicola

> **Documento Oficial de Arquitectura, Flujos de Datos, Tecnologías e Integraciones**  
> *Sistemas: Cenicola Hub (ERP / Dashboard Administrativo) y Cenicola Web Store (Tienda E-Commerce)*

---

## 📋 Índice
1. [Visión General del Ecosistema](#1-visión-general-del-ecosistema)
2. [Arquitectura del Sistema](#2-arquitectura-del-sistema)
3. [Stack Tecnológico y Dependencias](#3-stack-tecnológico-y-dependencias)
4. [Infraestructura, Servidores, Dominios y Entorno](#4-infraestructura-servidores-dominios-y-entorno)
5. [Estructura de Directorios y Repositorios](#5-estructura-de-directorios-y-repositorios)
6. [Modelo de Datos (Base de Datos & Prisma Schema)](#6-modelo-de-datos-base-de-datos--prisma-schema)
7. [Modelo de Autenticación, Usuarios y Roles (RBAC)](#7-modelo-de-autenticación-usuarios-y-roles-rbac)
8. [Flujos Operativos y Ciclos de Vida](#8-flujos-operativos-y-ciclos-de-vida)
9. [Integraciones y APIs Externas](#9-integraciones-y-apis-externas)

---

## 1. Visión General del Ecosistema

El ecosistema digital de **Cenicola** está diseñado como una plataforma integral de comercio electrónico y gestión empresarial (ERP / POS multicanal) adaptada a la dinámica comercial venezolana (manejo multimoneda, tasa oficial BCV, dólares efectivo/transferencia/Zelle/USDT y despacho por agencias de encomienda nacionales).

El ecosistema se compone de **dos aplicaciones independientes pero estrechamente integradas**:

1. **Cenicola Web Store (`cenicola-store-web`)**:
   - **Propósito**: Tienda web pública orientada al cliente final (B2C y Venta al Mayor).
   - **Funcionalidades**: Exploración de catálogo, filtrado por tallas/colores, carrito de compras, selección de modalidad de pago (BCV o Divisas), registro/login de clientes con verificación por PIN, checkout con subida de comprobantes de pago y seguimiento de orden en tiempo real con foto del paquete despachado.

2. **Cenicola Hub (`Cenicola Hub`)**:
   - **Propósito**: Panel administrativo centralizado de control operativo, financiero y logístico.
   - **Funcionalidades**: Control de inventario multicanal (Online / Tienda física), aprobación y verificación de pagos por administración, módulo de embalaje y despacho para operarios, gestión de vendedores y comisiones, nómina, cierres de caja/tienda, cortes de sistema y finanzas (cuentas por cobrar/pagar y gastos).

---

## 2. Arquitectura del Sistema

El ecosistema utiliza una **Arquitectura de Base de Datos Compartida (Shared Database Multi-App Pattern)** sobre infraestructura Serverless.

```
                  ┌──────────────────────────────────────────┐
                  │            CLIENTE FINAL (WEB)           │
                  └────────────────────┬─────────────────────┘
                                       │
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │   Cenicola Web Store (Next.js 14 Web)    │
                  └────────────────────┬─────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
            ▼                          ▼                          ▼
   ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
   │ Cloudinary API  │        │   Resend API    │        │  WhatsApp API   │
   │ (Subida Imagen) │        │ (Email Transac) │        │(Asesoría Directa│
   └─────────────────┘        └─────────────────┘        └─────────────────┘
            ▲                          ▲
            │                          │
            ├──────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│             Base de Datos PostgreSQL (Hosted on Supabase AWS)          │
│                (Prisma ORM 7 + Transaction Pooler PgBouncer)           │
└────────────────────────────────────────────────────────────────────────┘
            ▲
            │
            ├──────────────────────────┐
            │                          │
            ▼                          ▼
   ┌─────────────────┐        ┌─────────────────┐
   │ DolarFlow API   │        │ Cloudinary API  │
   │ (Tasa BCV/Euro) │        │ (Comprobantes)  │
   └─────────────────┘        └─────────────────┘
                                       ▲
                                       │
                  ┌────────────────────┴─────────────────────┐
                  │     Cenicola Hub (Next.js 14 ERP / Hub)  │
                  └────────────────────▲─────────────────────┘
                                       │
                  ┌────────────────────┴─────────────────────┐
                  │    PERSONAL DE LA EMPRESA (ADMIN/POS)    │
                  └──────────────────────────────────────────┘
```

### Principios de Arquitectura:
- **Desacoplamiento Front/Back**: Las vistas administrativas y la tienda web se despliegan de forma independiente en Vercel, optimizando tiempos de carga y seguridad.
- **Acceso Directo y Consistente a Datos**: Ambas aplicaciones utilizan **Prisma ORM 7** conectado a la misma instancia de PostgreSQL en Supabase, garantizando que el stock y los precios estén sincronizados en tiempo real sin desfases.
- **Moneda Dual Automática (USD / VES)**: El sistema calcula dinámicamente los precios según la tasa oficial del día emitida por el Banco Central de Venezuela (BCV), obtenida de forma automatizada.

---

## 3. Stack Tecnológico y Dependencias

| Capa | Tecnología | Descripción / Rol |
| :--- | :--- | :--- |
| **Framework Web / App** | **Next.js 14.2 (App Router)** | Renderizado en servidor (SSR), Server Actions, API Routes y optimización de assets. |
| **Lenguaje** | **TypeScript 5** | Tipado estático estricto en modelos de datos, APIs y componentes. |
| **Estilos & UI** | **Tailwind CSS + Base UI / Shadcn** | Diseño responsivo, componentes accesibles y diseño limpio. |
| **Iconografía** | **Lucide React** | Conjunto de iconos vectoriales ligeros. |
| **Base de Datos** | **PostgreSQL (v15+)** | Motor de base de datos relacional alojado en Supabase AWS. |
| **ORM** | **Prisma ORM 7** | Cliente tipado de base de datos (`@prisma/client`) con driver PgBouncer (`@prisma/adapter-pg`). |
| **Autenticación** | **JWT (jose) + Bcryptjs + Supabase SSR** | Manejo de sesiones seguras mediante Cookies `HttpOnly` (`cenicola_session`) y cifrado de contraseñas. |
| **Almacenamiento de Imágenes** | **Cloudinary SDK** | CDN de subida y optimización de imágenes (fotos de productos, comprobantes de pago, etiquetas de envío). |
| **Envío de Correos** | **Resend API / Fetch** | Servicio para envío de emails transaccionales HTML (Confirmación, Verificación PIN, Envío de guía). |
| **Integración de Moneda** | **DolarFlow API** | Consulta automatizada de tasa oficial BCV, Euro, Paralelo y BTC. |
| **Compresión de Imágenes Client-side** | **browser-image-compression** | Optimización de comprobantes adjuntados por el cliente antes de subirlos. |
| **Exportación de Datos** | **ExcelJS** | Generación de reportes contables y financieros en `.xlsx`. |
| **PWA (Mobile App Support)** | **@ducanh2912/next-pwa** | Compatibilidad para instalación como aplicación web progresiva en dispositivos móviles. |

---

## 4. Infraestructura, Servidores, Dominios y Entorno

### 📍 Servidores y Hosting
- **Servidor Web / Aplicación**: Ambas aplicaciones están preparadas para despliegue serverless en la plataforma **Vercel** o contenedores Docker en VPS (`docker-compose.yml`).
- **Servidor de Base de Datos**: Alojado en la nube de **Supabase (AWS Infrastructure)**.
  - **Puerto 6543**: Transaction Pooler (PgBouncer) usado por la aplicación para alto rendimiento de conexiones concurrentes.
  - **Puerto 5432**: Conexión directa utilizada exclusivamente para ejecuciones de migraciones (`prisma migrate deploy`).

### 🌐 Dominios y Configuración
- **Dominio Principal**: Configurado mediante la variable `NEXT_PUBLIC_APP_URL` (Ejemplo: `https://cenicolas.com` o subdominios asociados como `https://hub.cenicolas.com`).
- **Dominio de Email**: Correos enviados desde `Cenicola Hub <notificaciones@cenicolas.com>` mediante dominio verificado en **Resend**.

### 🔑 Variables de Entorno Clave (`.env`)
```env
# Base de Datos (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.[REF]:[PASS]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Client Credentials
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT_REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbG..."
SUPABASE_SERVICE_ROLE_KEY="eyJhbG..."

# Autenticación y App URL
NEXTAUTH_SECRET="clave-super-secreta-jwt"
NEXT_PUBLIC_APP_URL="https://cenicolas.com"

# Proveedor de Email (Resend)
RESEND_API_KEY="re_123456789..."
EMAIL_FROM="Cenicola Hub <notificaciones@cenicolas.com>"

# Almacenamiento Cloudinary
CLOUDINARY_CLOUD_NAME="cenicola"
CLOUDINARY_API_KEY="123456789"
CLOUDINARY_API_SECRET="abc123secret"

# WhatsApp Corporativo
NEXT_PUBLIC_WHATSAPP_PHONE="584220296537"
```

---

## 5. Estructura de Directorios y Repositorios

### Repositorio 1: `Cenicola Hub` (ERP / Admin)
```
Cenicola Hub/
├── app/
│   ├── (auth)/                # Rutas de autenticación administrativa (/login)
│   ├── (dashboard)/           # Panel administrativo restringido
│   │   └── dashboard/
│   │       ├── carritos/      # Carritos activos de vendedoras / cotizaciones
│   │       ├── cierre-tienda/ # Cuadre financiero de caja y cierres por periodo
│   │       ├── clientes/      # Directorio y gestión de clientes B2B/B2C
│   │       ├── embalaje/      # Módulo para operarios de empaque y seguimiento de guías
│   │       ├── finanzas/      # Gastos, Nóminas, Cuentas por Cobrar y Cuentas por Pagar
│   │       ├── inventario/    # Control de stock total, online y tienda física
│   │       ├── ordenes/       # Gestión de pedidos, verificación de comprobantes y estados
│   │       ├── pagos/         # Conciliación bancaria de pagos recibidos
│   │       ├── productos/     # Catálogo de productos, variantes, precios y fotos
│   │       ├── tasas/         # Monitor e historial de tasa de cambio (BCV/Euro)
│   │       └── usuarios/      # Administración de usuarios internos y roles
│   └── api/                   # API Routes de backend (Endpoints REST para el Hub y la Web Store)
├── components/
│   ├── shared/                # Componentes reutilizables (Sidebar, Formularios, Modales)
│   └── ui/                    # UI Kit atómico (Botones, Inputs, Cards, Badges)
├── lib/
│   ├── api-auth.ts            # Verificación de permisos y JWT en APIs
│   ├── cierre-tienda.ts       # Algoritmos de cierre financiero
│   ├── cloudinary.ts          # Cliente de subida a CDN Cloudinary
│   ├── emails.ts              # Plantillas HTML y cliente de Resend API
│   ├── prisma.ts              # Instancia singleton de Prisma Client
│   ├── tasa-cambio.ts         # Integración con DolarFlow (BCV) y caché
│   └── whatsapp.ts            # Generador de enlaces y formateador de mensajes WhatsApp
├── prisma/
│   ├── schema.prisma          # Definición única de la base de datos relacional
│   └── seed.ts                # Semilla de datos e inicio de usuario administrador
└── middleware.ts              # Protección de rutas por JWT y RBAC por Roles
```

### Repositorio 2: `cenicola-store-web` (E-Commerce Cliente)
```
cenicola-store-web/
├── app/
│   ├── catalogo/              # Exploración de productos por categorías y filtros
│   ├── checkout/              # Proceso de pago, dirección de envío y subida de comprobante
│   ├── consultar-orden/       # Rastreo de pedido público con cédula y número de orden
│   ├── cuenta/                # Perfil de cliente, historial de compras y estado de envíos
│   ├── producto/              # Vista detallada de producto (Fotos, tallas, colores, stock)
│   └── politicas/             # Páginas informativas (Envíos, Términos y Condiciones)
├── components/
│   └── web/                   # Componentes de la tienda (Header, Carrito flotante, Autenticación)
└── lib/                       # Utilidades de frontend de cliente
```

---

## 6. Modelo de Datos (Base de Datos & Prisma Schema)

El esquema relacional de la base de datos administra todo el ciclo de vida comercial. A continuación se detallan las entidades clave y sus relaciones:

```mermaid
erDiagram
    USER ||--o{ PRODUCT : crea
    USER ||--o{ ORDER : gestiona
    USER ||--o{ ORDER_PAYMENT : verifica
    USER ||--o{ ORDER_SHIPMENT : empaca
    CUSTOMER ||--o{ ORDER : realiza
    PRODUCT ||--|{ PRODUCT_VARIANT : posee
    PRODUCT_VARIANT ||--o{ INVENTORY_MOVEMENT : registra
    PRODUCT_VARIANT ||--o{ ORDER_ITEM : incluye
    ORDER ||--|{ ORDER_ITEM : contiene
    ORDER ||--o{ ORDER_PAYMENT : recibe
    ORDER ||--o| ORDER_SHIPMENT : genera
    EXCHANGE_RATE ||--o{ ORDER : aplica_tasa
```

### Principales Tablas del Sistema:
1. **`users`**: Personal interno de Cenicola con contraseña hasheada y asignación de rol (`admin`, `inventario`, `embalador`, `vendedora_online`, `vendedora_tienda`).
2. **`customers`**: Clientes finales registrados o creados desde caja. Guarda documento de identidad (`V`, `J`, `P`, `E`), correo, contraseña encriptada y estado de verificación PIN.
3. **`products` & `product_variants`**: Productos base (nombre, fotos en Cloudinary) y sus variantes físicas (SKU único, talla, color, stock total, stock online, stock tienda, precio BCV y precio Divisas).
4. **`inventory_movements`**: Audita cada incremento o decremento de stock por canal (`online`, `tienda`), registrando el motivo, cantidad previa y cantidad posterior.
5. **`orders`**: Registro central de pedidos. Almacena canal de origen, cliente, totales en USD y Bs, método de precio utilizado (`bcv` o `divisas`), y estado del pedido (`pendiente_pago`, `pago_parcial`, `pago_verificado`, `en_embalaje`, `enviada`, `completada`, `cancelada`).
6. **`order_payments`**: Pagos reportados por clientes o registradores. Guarda el tipo de pago (`efectivo_bs`, `efectivo_usd`, `transferencia`, `zelle`, `pago_movil`, `usdt`), monto en USD y VES, hash de referencia para prevenir duplicados, foto del comprobante en Cloudinary y estado de verificación (`pendiente`, `verificado`, `rechazado`).
7. **`order_shipments`**: Registro del empaque de la orden. Contiene usuario embalador, fotos de la bolsa/caja sellada, foto de la guía fisica, agencia de envío (`MRW`, `Zoom`, etc.) y número de tracking.
8. **`exchange_rates`**: Histórico diario de tasas de cambio (USD a VES BCV, Euro, Paralelo, BTC) sincronizadas automáticamente desde DolarFlow.
9. **`cierres_tienda` & `cierres_sistema`**: Controles de caja por periodo/canal y cortes globales de ciclos contables.

---

## 7. Modelo de Autenticación, Usuarios y Roles (RBAC)

El acceso al Hub Administrativo se controla estrictamente mediante **Control de Acceso Basado en Roles (RBAC)** gestionado en el middleware de Next.js (`middleware.ts`):

```
                               ┌──────────────────────────┐
                               │     Solicitud de Ruta    │
                               └────────────┬─────────────┘
                                            │
                                            ▼
                               ┌──────────────────────────┐
                               │ ¿Ruta Pública (/login)?  │
                               └──────┬─────────────────┬─┘
                                   Sí │                 │ No
                                      ▼                 ▼
                               ┌─────────────┐   ┌──────────────────────────┐
                               │ Permitir    │   │ Verificar Cookie JWT     │
                               │ Acceso      │   │ ("cenicola_session")     │
                               └─────────────┘   └──────────────┬───────────┘
                                                                │
                                                                ▼
                                                 ┌──────────────────────────┐
                                                 │ ¿Token Válido & Rol OK?  │
                                                 └──────┬─────────────────┬─┘
                                                     Sí │                 │ No
                                                        ▼                 ▼
                                                 ┌─────────────┐   ┌──────────────────────────┐
                                                 │ Permitir    │   │ Redirigir a /login       │
                                                 │ Navegación  │   │ o Dashboard correspondiente
                                                 └─────────────┘   └──────────────────────────┘
```

### Matriz de Permisos por Rol:

| Módulo / Ruta | Admin | Inventario | Embalador | Vendedora Online | Vendedora Tienda |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **/dashboard** (Métricas generales) | ✅ | ✅ | ❌ | ✅ | ✅ |
| **/dashboard/productos** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **/dashboard/inventario** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **/dashboard/ordenes** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **/dashboard/carritos** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **/dashboard/embalaje** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **/dashboard/pagos** (Verificación bancaria) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **/dashboard/finanzas** (Nómina/Gastos) | ✅ | ❌ | ❌ | ❌ | ❌ |
| **/dashboard/cierre-tienda** | ✅ | ❌ | ❌ | ❌ | ✅ |
| **/dashboard/usuarios** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 8. Flujos Operativos y Ciclos de Vida

### 8.1. Flujo de Compra E-Commerce (Cliente Final)

```mermaid
sequenceDiagram
    autonumber
    actor Cliente
    participant WebStore as Cenicola Web Store
    participant Cloudinary as Cloudinary CDN
    participant DB as Supabase PostgreSQL
    participant Hub as Cenicola Hub (Admin)
    participant Email as Resend Email Service

    Cliente->>WebStore: 1. Selecciona productos en Catálogo
    Cliente->>WebStore: 2. Procede al Checkout (Ingresa datos y elige Pago Móvil/Zelle)
    Cliente->>WebStore: 3. Adjunta foto de comprobante de pago
    WebStore->>Cloudinary: 4. Sube imagen de comprobante
    Cloudinary-->>WebStore: 5. Retorna URL segura de la imagen
    WebStore->>DB: 6. Crea Registro de Orden (Estado: pendiente_pago) y Pago (Estado: pendiente)
    WebStore->>Email: 7. Envía correo de confirmación de pedido recibido
    Hub->>DB: 8. Administrador verifica el pago en banco y cambia estado a "pago_verificado"
    DB-->>Email: 9. Notifica al cliente por correo: "¡Pago Verificado! Tu orden pasa a Embalaje"
```

### 8.2. Flujo de Venta Asesorada vía WhatsApp

```
1. Cliente navega por el catálogo y arma su carrito en la Web Store.
2. En lugar de pagar directamente en la web, hace clic en "Solicitar Asesoría por WhatsApp".
3. El sistema formatea un mensaje codificado con:
   - Nombre del cliente.
   - Lista detallada de ítems (tallas, colores, unidades y cálculo en docenas).
   - Tasa BCV del día aplicada.
   - Total exacto en USD y estimado en Bolívares.
4. Abre la API de WhatsApp Web/App conectando al cliente directamente con el número corporativo de la vendedora online.
```

### 8.3. Flujo Logístico de Embalaje y Despacho

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│ Pago Verificado por Adm │ ──> │ Orden aparece en el     │ ──> │ Embalador prepara       │
│ (Estado: pago_verificado)│     │ Módulo /embalaje        │     │ física de la orden      │
└─────────────────────────┘     └─────────────────────────┘     └────────────┬────────────┘
                                                                             │
                                                                             ▼
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│ Cliente puede rastrear  │ <── │ Envío de Email con foto │ <── │ Carga de Fotos del      │
│ la orden y foto en web  │     │ de paquete y N° Guía    │     │ Paquete y Guía de Envío │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

---

## 9. Integraciones y APIs Externas

### 1. **DolarFlow API (Cotizaciones de Moneda)**
- **Endpoints**:
  - Oficial (BCV): `https://dolarflow.com/api/oficial`
  - Euro: `https://dolarflow.com/api/euro`
  - Paralelo: `https://dolarflow.com/api/paralelo`
  - BTC: `https://dolarflow.com/api/btc`
- **Comportamiento**: El módulo `lib/tasa-cambio.ts` consulta el endpoint oficial al iniciar la jornada, almacena la tasa en la tabla `exchange_rates` y la mantiene en caché de memoria (TTL: 5 minutos) para evitar sobrecargar servicios externos. Si la API falla, utiliza como respaldo la última tasa registrada.

### 2. **Resend API (Transaccional de Email)**
- **Endpoint**: `https://api.resend.com/emails`
- **Mecanismo**: Peticiones HTTP POST con encabezado de autorización Bearer.
- **Plantillas implementadas**:
  - `sendWelcomeEmail`: Bienvenida a nuevos clientes registrados.
  - `sendVerificationPINCodeEmail`: Código PIN de 6 dígitos para validar el correo del cliente.
  - `sendOrderCreatedEmail`: Confirmación de recepción de pedido y comprobante.
  - `sendPaymentVerifiedEmail`: Notificación de pago verificado e inicio de embalaje.
  - `sendOrderShippedEmail`: Notificación de despacho con número de guía MRW/Zoom y foto del paquete.

### 3. **Cloudinary CDN (Almacenamiento de Multimedia)**
- **Método**: Carga binaria mediante `upload_stream` en el SDK oficial de Cloudinary.
- **Carpetas en Cloudinary**:
  - `/productos`: Fotografías de catálogo de mercancía.
  - `/comprobantes`: Comprobantes de pago subidos por clientes.
  - `/embalaje`: Fotos de paquetes embalados y guías impresas de encomienda.

---

> **Mantenimiento y Actualizaciones**: Este documento debe ser actualizado cada vez que se agreguen nuevos modelos al esquema de Prisma, nuevas integraciones de pasarelas de pago o cambios en la arquitectura de servidores.
