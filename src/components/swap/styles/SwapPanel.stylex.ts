/**
 * StyleX styles for SwapPanel and its subcomponents.
 * Merged from Layout, Form, and Quote domain files for a single import surface.
 */

import { swapPanelLayoutStyles } from "./SwapPanelLayout.stylex";
import { swapPanelFormStyles } from "./SwapPanelForm.stylex";
import { swapPanelQuoteStyles } from "./SwapPanelQuote.stylex";

/** Combined styles: use swapPanelStyles as styles in SwapPanel and subcomponents. */
export const swapPanelStyles = {
  ...swapPanelLayoutStyles,
  ...swapPanelFormStyles,
  ...swapPanelQuoteStyles,
};
