import { type RouteConfig, route, layout } from "@react-router/dev/routes";

export default [
  route("login", "routes/login.tsx"),
  layout("routes/layout.tsx", [
    route("", "routes/dashboard.tsx", { index: true }),
    route("seats", "routes/seats.tsx"),
    route("seats/:id", "routes/seat-detail.tsx"),
    route("sms-providers", "routes/sms-providers.tsx"),
    route("tokens", "routes/tokens.tsx"),
    route("webhooks", "routes/webhooks.tsx"),
    route("docs", "routes/api-docs.tsx"),
    route("users", "routes/users.tsx"),
  ]),
] satisfies RouteConfig;
