import path from "node:path";
import { readFileSync } from "node:fs";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import {
  MORTGAGE_INTEREST_RATE_PERCENT,
  MORTGAGE_TERM_YEARS,
  PARKING_PRICE,
  VAT_PERCENT,
  type LotteryInput,
  type LotteryRow,
} from "@/lib/lottery-calc";

// PDFים בעברית (RTL) עם הגופן והלוגו של המותג. נוצרים בשרת בלבד.

const FONT_DIR = path.join(process.cwd(), "assets/fonts");
const LOGO_PATH = path.join(process.cwd(), "assets/logo/tico-finance-he.png");

let fontsReady = false;
function ensureFonts() {
  if (fontsReady) return;
  Font.register({
    family: "Heebo",
    fonts: [
      { src: path.join(FONT_DIR, "Heebo-Hebrew-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Heebo-Hebrew-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // בלי שבירת מילים אוטומטית (ההיפוך של עברית שובר מילים באמצע).
  Font.registerHyphenationCallback((word) => [word]);
  fontsReady = true;
}

const GREEN = "#1f6b43";
const GREEN_LIGHT = "#cfe8d8";
const TEXT = "#26332b";
const MUTED = "#6b7a70";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Heebo",
    fontSize: 10,
    color: TEXT,
    padding: 36,
    direction: "rtl",
  },
  header: {
    flexDirection: "row-reverse",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: GREEN,
    paddingBottom: 12,
    marginBottom: 16,
  },
  logo: { width: 130 },
  title: { fontSize: 18, fontWeight: 700, color: GREEN, textAlign: "right" },
  subtitle: { fontSize: 10, color: MUTED, textAlign: "right", marginTop: 2 },
  h2: {
    fontSize: 12,
    fontWeight: 700,
    color: GREEN,
    textAlign: "right",
    marginTop: 14,
    marginBottom: 6,
  },
  kvWrap: {
    flexDirection: "row-reverse",
    flexWrap: "wrap",
    borderWidth: 1,
    borderColor: GREEN_LIGHT,
    borderRadius: 4,
    padding: 6,
  },
  kv: { width: "50%", flexDirection: "row-reverse", paddingVertical: 2, paddingHorizontal: 4 },
  kvLabel: { color: MUTED, textAlign: "right" },
  kvValue: { fontWeight: 700, textAlign: "right", marginRight: 4 },
  tr: {
    flexDirection: "row-reverse",
    borderBottomWidth: 1,
    borderBottomColor: "#e5ece7",
    paddingVertical: 5,
  },
  thRow: {
    flexDirection: "row-reverse",
    backgroundColor: GREEN,
    paddingVertical: 5,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  th: { color: "#ffffff", fontWeight: 700, fontSize: 9, textAlign: "right", paddingHorizontal: 5 },
  td: { fontSize: 9.5, textAlign: "right", paddingHorizontal: 5 },
  tdStrong: { fontSize: 9.5, textAlign: "right", paddingHorizontal: 5, fontWeight: 700, color: GREEN },
  note: { fontSize: 8.5, color: MUTED, textAlign: "right", marginTop: 6, lineHeight: 1.5 },
  couponBox: {
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: GREEN,
    borderStyle: "dashed",
    borderRadius: 6,
    backgroundColor: "#f3faf5",
    padding: 10,
  },
  couponTitle: { fontSize: 12, fontWeight: 700, color: GREEN, textAlign: "right" },
  couponText: { fontSize: 9.5, textAlign: "right", marginTop: 3, lineHeight: 1.5 },
  footer: {
    position: "absolute",
    left: 36,
    right: 36,
    bottom: 24,
    borderTopWidth: 1,
    borderTopColor: "#e5ece7",
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: MUTED, textAlign: "right", lineHeight: 1.5 },
});

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const shekel = (n: number) => `${nf.format(Math.round(n))} ₪`;

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

export function formatCouponNumber(n: number) {
  return String(n).padStart(4, "0");
}

function logoSrc() {
  return readFileSync(LOGO_PATH);
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {/* eslint-disable-next-line jsx-a11y/alt-text */}
      <Image src={logoSrc()} style={styles.logo} />
    </View>
  );
}

function Table({
  cols,
  rows,
}: {
  cols: { label: string; flex: number; strong?: boolean }[];
  rows: string[][];
}) {
  return (
    <View>
      <View style={styles.thRow}>
        {cols.map((c) => (
          <Text key={c.label} style={[styles.th, { flex: c.flex }]}>
            {c.label}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={styles.tr} wrap={false}>
          {r.map((cell, j) => (
            <Text
              key={j}
              style={[cols[j].strong ? styles.tdStrong : styles.td, { flex: cols[j].flex }]}
            >
              {cell}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

export type ReportCoupon = {
  number: number;
  code: string;
  discountPercent: number;
  expiresAt: Date;
};

function ReportDocument({
  name,
  input,
  rows,
  coupon,
  date,
}: {
  name: string;
  input: LotteryInput;
  rows: LotteryRow[];
  coupon: ReportCoupon | null;
  date: Date;
}) {
  const facts: [string, string][] = [
    ["מחיר מוצג למ״ר (ללא מע״מ)", shekel(input.pricePerSqm)],
    ["הנחה (מסלול א׳)", `${input.discountPercent}%`],
    ["תקרת הנחה (מסלול ב׳)", shekel(input.discountCap)],
    [
      "מחיר ייחוס למ״ר",
      input.referencePrice > 0 ? shekel(input.referencePrice) : "לא הוזן",
    ],
    ["מרפסת", `${input.balconySqm} מ״ר`],
    ["מחסן", `${input.storageSqm} מ״ר`],
    ["חניות", `${input.parkingCount} (${shekel(PARKING_PRICE)} לחניה)`],
    ["מענק מקום", input.grant > 0 ? shekel(input.grant) : "אין"],
  ];

  return (
    <Document title="דוח הערכה - הגרלת דיור" author="TICO FINANCE">
      <Page size="A4" style={styles.page}>
        <Header
          title="דוח הערכה להגרלת דיור"
          subtitle={`הוכן עבור ${name} · ${formatDate(date)}`}
        />

        <Text style={styles.h2}>נתוני ההגרלה שהוזנו</Text>
        <View style={styles.kvWrap}>
          {facts.map(([label, value]) => (
            <View key={label} style={styles.kv}>
              <Text style={styles.kvLabel}>{label}:</Text>
              <Text style={styles.kvValue}>{value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.h2}>מחיר דירה לפי גודל</Text>
        <Table
          cols={[
            { label: "גודל", flex: 1.3 },
            { label: "מ״ר לחישוב", flex: 1 },
            { label: `לפני הנחה (כולל מע״מ ${VAT_PERCENT}%)`, flex: 1.6 },
            { label: "הנחה בפועל", flex: 1.2 },
            { label: "מחיר חוזה (כולל חניה)", flex: 1.5, strong: true },
          ]}
          rows={rows.map((r) => [
            `${r.size.label} (${r.size.mainSqm} מ״ר)`,
            r.calcSqm.toFixed(1),
            shekel(r.preDiscountIncVat),
            shekel(r.discount),
            shekel(r.contractPrice),
          ])}
        />

        <Text style={styles.h2}>הון עצמי ומשכנתא</Text>
        <Table
          cols={[
            { label: "גודל", flex: 1.3 },
            { label: "הון עצמי נדרש", flex: 1.3, strong: true },
            { label: "גובה משכנתא", flex: 1.3 },
            ...MORTGAGE_TERM_YEARS.map((y) => ({ label: `החזר ל-${y} שנה`, flex: 1.2 })),
          ]}
          rows={rows.map((r) => [
            r.size.label,
            shekel(r.equity),
            shekel(r.mortgage),
            ...MORTGAGE_TERM_YEARS.map((y) => shekel(r.monthlyPayments[y])),
          ])}
        />
        <Text style={styles.note}>
          המשכנתא מחושבת לפי כללי מחיר למשתכן: עד 75% משווי השוק, בכפוף למינימום הון עצמי. ההחזר החודשי
          מוערך לפי ריבית ממוצעת לדוגמה של {MORTGAGE_INTEREST_RATE_PERCENT}% ואינו הצעה מחייבת של בנק.
        </Text>

        {coupon && (
          <View style={styles.couponBox} wrap={false}>
            <Text style={styles.couponTitle}>
              מתנה: קופון {coupon.discountPercent}% הנחה על שירות מלא
            </Text>
            <Text style={styles.couponText}>
              קופון מספר {formatCouponNumber(coupon.number)} · בתוקף עד {formatDate(coupon.expiresAt)}.
              הקופון עצמו מצורף במייל שאליו צורף הדוח (קישור להורדה).
            </Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            הדוח הוא הערכה בלבד ואינו מהווה ייעוץ פיננסי או הצעה מחייבת. יש לבדוק את פרטי ההגרלה המדויקים באתר
            הרשמי ואת תנאי המימון מול הבנק.
          </Text>
          <Text style={styles.footerText}>צ׳יקו, אדריכל המשכנתאות · טלפון 050-7700322</Text>
        </View>
      </Page>
    </Document>
  );
}

// הקופון: תבנית שעוצבה ב-Canva (assets/coupon/coupon-template.png, בגודל 559x397)
// והפרטים האישיים - מספר, קוד אימות, שם ותוקף - מודפסים עליה מהמערכת.
const COUPON_TEMPLATE_PATH = path.join(process.cwd(), "assets/coupon/coupon-template.png");
const COUPON_W = 559;
const COUPON_H = 397;

const couponStyles = StyleSheet.create({
  page: { fontFamily: "Heebo", direction: "rtl" },
  bg: { position: "absolute", left: 0, top: 0, width: COUPON_W, height: COUPON_H },
  line: { position: "absolute", color: "#2e8b57", fontWeight: 700, textAlign: "center" },
});

function CouponDocument({
  name,
  coupon,
}: {
  name: string;
  coupon: ReportCoupon;
}) {
  const shownName = name.length > 40 ? `${name.slice(0, 38)}…` : name;
  return (
    <Document title={`קופון הנחה ${formatCouponNumber(coupon.number)}`} author="TICO FINANCE">
      <Page size={[COUPON_W, COUPON_H]} style={couponStyles.page}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={readFileSync(COUPON_TEMPLATE_PATH)} style={couponStyles.bg} />
        <Text style={[couponStyles.line, { left: 260, width: 294, top: 263, fontSize: 13 }]}>
          קופון מספר {formatCouponNumber(coupon.number)} · קוד אימות {coupon.code}
        </Text>
        <Text style={[couponStyles.line, { left: 260, width: 294, top: 282, fontSize: 10.5 }]}>
          הונפק עבור: {shownName}
        </Text>
        <Text style={[couponStyles.line, { left: 284, width: 170, top: 371, fontSize: 9.5 }]}>
          בתוקף עד {formatDate(coupon.expiresAt)}
        </Text>
        <Text
          style={[couponStyles.line, { left: 270, width: 190, top: 384, fontSize: 6.5, fontWeight: 400 }]}
        >
          ההנחה חלה על שירות מלא בלבד · הקופון ממוספר ומאומת במערכת
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReportPdf(args: {
  name: string;
  input: LotteryInput;
  rows: LotteryRow[];
  coupon: ReportCoupon | null;
}): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<ReportDocument {...args} date={new Date()} />);
}

export async function renderCouponPdf(args: {
  name: string;
  coupon: ReportCoupon;
}): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<CouponDocument {...args} />);
}
