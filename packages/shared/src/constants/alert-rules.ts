/** How a rule finds articles: by keywords (all must appear) or by one category. */
export const ALERT_RULE_TYPES = ['keywords', 'category'] as const;

export const ALERT_RULE_NAME_MAX_LENGTH = 60;
export const KEYWORDS_MAX = 10;
/** Length of one keyword. A keyword can be a phrase with spaces, e.g. "electric car". */
export const KEYWORD_MIN_LENGTH = 2;
export const KEYWORD_MAX_LENGTH = 50;
/** Rules one user can have. Small enough that the list needs no pagination. */
export const ALERT_RULES_PER_USER_MAX = 20;
