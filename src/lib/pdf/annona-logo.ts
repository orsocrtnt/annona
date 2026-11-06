/**
 * Logo Annona pour le pied des relevés PDF, embarqué pour ne dépendre d'aucun fichier public
 * au runtime (fonctions serverless). Source : public/brand/logo-horizontal-fond-clair.png,
 * ramené à 240×71 px en PNG palette avec sharp.
 */
export const ANNONA_LOGO_SIZE = { width: 240, height: 71 } as const;

export const ANNONA_LOGO_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAPAAAABHCAMAAAAORDptAAADAFBMVEVMaXE/PwArIBoqIBsAAAA/AAAyGRkAAAABAQFVAAAkJCQr" +
  "IBoqIRsrIRoqIBoqIBorIRshHx8rHxorIRspAAUqIRoqIRsqIRoqIRsrIRsrIRotHh5/AAAzMxwrIBoqIRspIRkrIRsrIRksIhwq" +
  "IBsnHRYqEwAqIRkrHxoqIRskIhYrIRsqIBoqKiorIRsqHxkqIBorIRstIxwsIRkrIRsqIBoqIRopHxgrIBoqIBorIRoqIBoqHBoq" +
  "IBorIBsqIBosIRkqHxkrHxoqIRoqIBoqIBgtIxwpIRkrIRopHxoqIBoqIBkqIBorIBoqIRsqIBsrIRoqGBUnGxkqIBkqIBorIRsq" +
  "HxgqIBknJxMrIBorIRspHhkcHBcnIBoqIBo4HBwrIBoqIBoqHxoqIRoqIBopIBojHQ8qIBoAAAApHxksIhsqIBorHxsqIRoqIBop" +
  "IBgqIBoqIRoqIBspIBkqHxoqIBsqIRopHxkqIRoqIBsrIBsqIBopIBkrIBoqIBonIhkqIBktIhwqIBsrIRoqIBoqIBkrIRsqIBoq" +
  "IBorIBoqIBoqIBsrIBoqHxsrIBspIBorIBsqIBoqIBkqIBorIRopHxpICwA/Pz8rIhspIBkqIBoqIBouFxcqIBoqHxorIRsqIRop" +
  "IBsqIBopIBopIBotIiIqIBsoHhcqIRsqIBojIxcrIBklHhYrIBsqIRoqIBsrHhkrIBsrIhsqIBsqHhm3ZwAqIBotIhwqHxoqHxoq" +
  "HxoqIRpVAAAqIRopIBorIRssIhsqHxoqHxksIRswJR4qIRsnExMpIBoqIRspIBsrHxgsIRkqIRoqIBspIRoqHxopIBoqIRskJAAq" +
  "IBsrIBouIx0sIRwoHxsqHxorIBkqIRwrIRssIBsqIBorIhopHxoqIRsrIRspIBosIhsrIRsuIhwqHxkqIBspIRsrIRssIRwtIhwr" +
  "IhosIhssIhwtIxwuIx0tIhwtIx0rIRswJR4sIhsuJB0vJB4vJB0sIRswJR8sIxwrIhwrIhstJB0uIxz3hWuUAAAA7nRSTlMABPn7" +
  "AwQKAQIDB/jW9/pO/ghwsAWP+8D8/NURAgV8uCX9Y/7oGQY8mPUOqpQG8lPF+/0Wz2DuPau59mISZ/neLVyZWuo2/mvfQ+Qe0tv6" +
  "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";
