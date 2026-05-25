import { createFileRoute } from "@tanstack/react-router";

function disabledProviderResponse(provider: string) {
  return new Response(
    JSON.stringify({
      received: true,
      active: false,
      provider,
      message: "GWLanguageFlow agora processa pagamentos exclusivamente pela ValidaPay.",
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async () => disabledProviderResponse("stripe"),
    },
  },
});
