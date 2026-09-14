# Security Policy

No publicar API keys privadas, service role keys, webhook secrets, contraseñas ni datos reales de clientes en issues, commits o capturas.

La publishable key de Supabase puede existir en el frontend por diseño; eso no reemplaza RLS. Cualquier operación privilegiada debe estar protegida en base de datos o servidor.

Si se detecta una exposición de secreto, rotarlo primero y después corregir el repositorio. No basta con borrar el commit visible porque el valor permanece en el historial.
