// סיבות הסרה שמוצגות בדף ההסרה מהרשימה. המפתח נשמר במסד, התווית מוצגת ללקוח.
export const UNSUBSCRIBE_REASONS = [
  { key: "too_many", label: "מקבל/ת יותר מדי מיילים" },
  { key: "not_relevant", label: "התכנים לא רלוונטיים אליי" },
  { key: "done", label: "כבר סגרתי את הנושא (דירה / משכנתא)" },
  { key: "not_signed_up", label: "לא זכור לי שנרשמתי לרשימה" },
] as const;

export const UNSUBSCRIBE_REASON_KEYS: string[] = UNSUBSCRIBE_REASONS.map((r) => r.key);
export const UNSUBSCRIBE_OTHER_KEY = "other";
