import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { orderIntakeExtractionSchema } from "./order-intake.schema";
import { ORDER_INTAKE_SYSTEM_PROMPT, buildOrderIntakeUserContent } from "./order-intake.prompt";
import {
  OrderIntakeProviderError,
  type OrderIntakeExtractRequest,
  type OrderIntakeModelProvider,
} from "./order-intake.provider";

/** Haiku le plus récent (skill claude-api, tarifs du 2026-10-06 : 0,10 $ / 0,50 $ par million de jetons). */
export const ORDER_INTAKE_MODEL = "claude-haiku-5-5";
/** Borne la réponse : réflexion éventuelle + JSON du brouillon (quelques centaines de jetons). */
export const ORDER_INTAKE_MAX_TOKENS = 4096;
const REQUEST_TIMEOUT_MS = 30_000;

type MessagesClient = Pick<Anthropic, "messages">;

/** JSON Schema dérivé du schéma Zod ; contraintes non gérées retirées par le SDK, revalidées ici. */
const OUTPUT_SCHEMA = zodOutputFormat(orderIntakeExtractionSchema).schema;

/**
 * Implémentation Anthropic. Aucun outil n'est déclaré : le modèle ne peut rien exécuter.
 * La température n'est pas transmise : Claude Haiku 5.5 refuse toute valeur non par défaut
 * (400) ; l'effort bas joue ce rôle de sobriété.
 */
export function createAnthropicOrderIntakeProvider(options: {
  apiKey: string;
  client?: MessagesClient;
}): OrderIntakeModelProvider {
  const client: MessagesClient =
    options.client ?? new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: REQUEST_TIMEOUT_MS });

  return {
    model: ORDER_INTAKE_MODEL,
    async extract(request: OrderIntakeExtractRequest) {
      let response: Anthropic.Message;
      try {
        response = await client.messages.create({
          model: ORDER_INTAKE_MODEL,
          max_tokens: ORDER_INTAKE_MAX_TOKENS,
          system: [{ type: "text", text: ORDER_INTAKE_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: buildOrderIntakeUserContent(request) }],
          output_config: { effort: "low", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
        });
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new OrderIntakeProviderError("not_configured", "Clé du fournisseur refusée");
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new OrderIntakeProviderError("rate_limited", "Limite du fournisseur atteinte");
        }
        throw new OrderIntakeProviderError("upstream", error instanceof Anthropic.APIError ? `Fournisseur : ${error.status}` : "Fournisseur injoignable");
      }

      const usage = {
        inputTokens:
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0),
        outputTokens: response.usage.output_tokens,
      };
      if (response.stop_reason === "refusal") throw new OrderIntakeProviderError("refusal", "Analyse refusée par le modèle", usage);
      if (response.stop_reason === "max_tokens") throw new OrderIntakeProviderError("truncated", "Réponse tronquée", usage);

      const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
      try {
        return { output: JSON.parse(text) as unknown, usage };
      } catch {
        throw new OrderIntakeProviderError("invalid_json", "Réponse illisible", usage);
      }
    },
  };
}
