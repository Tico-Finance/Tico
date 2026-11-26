# חיבור הגיליון (Google Apps Script), גרסה 2

הסקריפט מקבל ליד, שומר בגיליון, שולח מייל התראה, ושומר אירועי מדידה בלשונית נפרדת.

**חשוב:** את הסיסמה האמיתית (`SECRET`) לא שומרים בקוד או ב-git. היא נמצאת רק ב-Apps Script וב-Vercel (`LEAD_WEBHOOK_SECRET`).

1. בגיליון: **Extensions > Apps Script**, מחקו את הקוד הקיים והדביקו (והחליפו את `SECRET` בסיסמה האמיתית):

```js
const SECRET = "שנה-לסיסמה-ארוכה";
const NOTIFY_EMAIL = "tico.z@ticofinance.co.il";
const HEADERS = ["תאריך","שם","טלפון","מייל","הכנסה נטו","התחייבויות","הון עצמי","סוג נכס","משכנתה אפשרית","שווי נכס מקסימלי","החזר חודשי","הסכמה ליצירת קשר","הסכמה לדיוור","גרסת נוסח הסכמה","מקור","מדיום","קמפיין","תוכן","אתר מפנה","מזהה שיחה"];
const EVENT_HEADERS = ["תאריך","מזהה שיחה","אירוע","מקור","מדיום","קמפיין","תוכן","אתר מפנה"];

function ensureHeaders_(sh, headers) {
  const cur = sh.getLastRow() === 0 ? [] : sh.getRange(1, 1, 1, headers.length).getValues()[0];
  if (cur.join("|") !== headers.join("|")) {
    if (sh.getLastRow() === 0) sh.appendRow(headers);
    else sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sh;
}

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput("forbidden");
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (d.type === "event") {
    let ev = ss.getSheetByName("אירועים");
    if (!ev) ev = ss.insertSheet("אירועים");
    ensureHeaders_(ev, EVENT_HEADERS).appendRow([new Date(), d.sessionId, d.event, d.source, d.medium, d.campaign, d.content, d.referrer]);
    return ContentService.createTextOutput("ok");
  }

  // ליד: נשמר בלשונית הראשונה בגיליון
  const sh = ensureHeaders_(ss.getSheets()[0], HEADERS);
  sh.appendRow([new Date(), d.name, "'" + d.phone, d.email, d.income, d.obligations,
    d.equity, d.deal, d.maxMortgage, d.maxPrice, d.monthlyPayment,
    d.consentContact ? "כן" : "לא", d.consentMarketing ? "כן" : "לא", d.consentVersion,
    d.source, d.medium, d.campaign, d.content, d.referrer, d.sessionId]);

  try {
    const n = (x) => Number(x || 0).toLocaleString("he-IL");
    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      replyTo: d.email,
      subject: "ליד חדש: " + d.name + " - " + d.phone,
      body:
        "ליד חדש מהמחשבון\n\n" +
        "שם: " + d.name + "\n" +
        "טלפון: " + d.phone + "\n" +
        "מייל: " + d.email + "\n\n" +
        "סוג נכס: " + d.deal + "\n" +
        "הכנסה נטו: " + n(d.income) + " ₪\n" +
        "התחייבויות: " + n(d.obligations) + " ₪\n" +
        "הון עצמי: " + n(d.equity) + " ₪\n\n" +
        "משכנתה אפשרית עד: " + n(d.maxMortgage) + " ₪\n" +
        "שווי נכס מקסימלי: " + n(d.maxPrice) + " ₪\n" +
        "החזר חודשי: " + n(d.monthlyPayment) + " ₪\n\n" +
        "הסכמה ליצירת קשר: " + (d.consentContact ? "כן" : "לא") + "\n" +
        "הסכמה לדיוור שיווקי: " + (d.consentMarketing ? "כן" : "לא (אסור לצרף לרשימת תפוצה)") + "\n" +
        "מקור: " + [d.source, d.medium, d.campaign].filter(String).join(" / ") + (d.referrer ? " (מ-" + d.referrer + ")" : "") + "\n\n" +
        "וואטסאפ ללקוח: https://wa.me/972" + String(d.phone).replace(/\D/g, "").replace(/^0/, "") + "\n" +
        "הגיליון: " + ss.getUrl()
    });
  } catch (err) {}

  return ContentService.createTextOutput("ok");
}
```

2. **Deploy > Manage deployments**, סמל העיפרון, ב-Version בחרו **New version**, ו-**Deploy**. הכתובת נשארת אותה כתובת.
3. מחקו מהגיליון את שורות הבדיקה הישנות. הסקריפט מעדכן את שורת הכותרות לבד.
4. ב-Vercel, בפרויקט `tico-lite`, הוסיפו משתנה `EVENTS_ENABLED` = `1`, ואחריו Redeploy.

## משתני סביבה נוספים (Vercel, Redeploy אחרי כל שינוי)
- `NEXT_PUBLIC_BOOKING_URL`: קישור לתשלום וקביעת מועד לפגישת האסטרטגיה. כל עוד אין, כפתור הפגישה פותח וואטסאפ אליכם עם הודעה מוכנה.
- `NEXT_PUBLIC_COMMUNITY_URL`: קישור הזמנה לקהילת הוואטסאפ. כל עוד אין, הכפתור לא מוצג.
- `NEXT_PUBLIC_MEETING_CREDIT` = `1`: להציג שהסכום מקוזז מדמי הטיפול (רק אחרי שהוחלט).
