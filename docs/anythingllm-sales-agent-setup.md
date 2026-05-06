# AnythingLLM Sales Agent Setup

This landing is ready to use AnythingLLM as the main RAG engine through a Vercel proxy.

## Flow

Landing browser -> `/api/chat` on Vercel -> Cloudflare Tunnel -> AnythingLLM -> Vercel -> browser.

Supabase is optional at runtime. If configured, Vercel also stores leads, messages, scores, and CTA events.

## Vercel Environment Variables

Set these in the `landing-ciberseguridad` Vercel project.

```bash
ANYTHINGLLM_BASE_URL=https://agente.tudominio.com
ANYTHINGLLM_API_KEY=ANLLM_REEMPLAZAR
ANYTHINGLLM_WORKSPACE_SLUG=ciberseguridad-proactiva-ia
ANYTHINGLLM_MODE=chat
HOTMART_URL=https://pay.hotmart.com/V105422735Y?off=ykvzwja6
SUPABASE_URL=https://REEMPLAZAR.supabase.co
SUPABASE_SERVICE_ROLE_KEY=REEMPLAZAR_SOLO_EN_VERCEL
```

If the AnythingLLM hostname is protected by Cloudflare Access, also set:

```bash
CLOUDFLARE_ACCESS_CLIENT_ID=REEMPLAZAR
CLOUDFLARE_ACCESS_CLIENT_SECRET=REEMPLAZAR
```

Never expose `ANYTHINGLLM_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in frontend code.

## AnythingLLM

1. Use the Docker version of AnythingLLM.
2. Create a workspace dedicated to the course.
3. Add the course documents, FAQ, guarantee, pricing, Hotmart access notes, and objections.
4. Create an API key from AnythingLLM settings.
5. Copy the workspace slug and use it in `ANYTHINGLLM_WORKSPACE_SLUG`.
6. Recommended workspace instruction:

```text
Eres el asesor de ventas del curso Ciberseguridad Proactiva e IA.
Responde en espanol claro y breve. Usa el RAG del workspace para responder dudas del curso.
Tu objetivo es ayudar al visitante a decidir con seguridad, calificar su interes y llevarlo a Hotmart cuando este listo.
No prometas empleo, ingresos, certificaciones externas ni resultados que no esten en los documentos.
Si no sabes algo, dilo y ofrece resolver con la informacion disponible.
```

Use `ANYTHINGLLM_MODE=chat` if you want the agent to answer broadly with RAG context. Use `query` only if you want it to refuse questions outside the documents.

## Cloudflare Tunnel

Use a named Cloudflare Tunnel instead of opening MikroTik inbound ports.

1. Install `cloudflared` on the machine or server that reaches AnythingLLM.
2. Create a public hostname such as `agente.tudominio.com`.
3. Route it to `http://localhost:3001` or the LAN IP where AnythingLLM listens.
4. Protect the hostname with Cloudflare Access.
5. Create a service token and put its client id/secret in Vercel.

For the university network, confirm you are allowed to publish the service and that persistent outbound tunnel traffic is permitted. If the tunnel is blocked, the widget still falls back to local FAQ responses and Hotmart CTA.

## Supabase

Create a new Supabase project for the course and run `supabase-sales-agent.sql` in the SQL editor.

The schema enables RLS and intentionally creates no public insert/select policies. The browser only talks to Vercel. Vercel writes with the service role key.

Tables:

- `sales_leads`: lead state, score, contact data, and last action.
- `sales_messages`: user and assistant turns.
- `sales_events`: widget opens, lead capture, and Hotmart clicks.

## VPS Migration

When moving AnythingLLM to a VPS, keep `/api/chat` unchanged and only update `ANYTHINGLLM_BASE_URL` in Vercel.

Recommended VPS setup:

- Dockerized AnythingLLM with persistent storage.
- NGINX or Caddy with HTTPS.
- Cloudflare Access or equivalent authentication in front of the AnythingLLM hostname.
- Scheduled backups for AnythingLLM storage and any vector database.
