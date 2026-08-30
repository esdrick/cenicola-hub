# Reglas de Migración y Despliegue de Base de Datos (Prisma + Vercel + Supabase)

Para cualquier cambio en la base de datos o modelos de Prisma en este proyecto, Antigravity debe seguir SIEMPRE este flujo organizado de 3 pasos:

## 1. Desarrollo Local
- Modificar `prisma/schema.prisma`.
- Generar y probar la migración localmente con:
  `npx prisma migrate dev --name <nombre_descriptivo>`

## 2. Aplicar Migración a Producción (Supabase)
- Aplicar las migraciones versionadas de `prisma/migrations/` a Supabase de forma segura:
  `npx prisma migrate deploy` (usando DATABASE_URL de producción).
- NUNCA incluir `prisma db push` en el script de build de Vercel para evitar fallos de producción por conflictos de datos o restricciones.

## 3. Despliegue Web en Vercel
- Mantener el script de build en `package.json` ligero: `"build": "prisma generate && next build"`.
- Subir el código mediante `git push origin main`.
