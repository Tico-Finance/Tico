# חיבור הגיליון (Google Apps Script)

1. צור גיליון Google חדש בשם "לידים - איפיון עצמי".
2. תפריט **Extensions > Apps Script**, מחק את הקוד והדבק:

```js
const SECRET = "שנה-לסיסמה-ארוכה";
const HEADERS = ["תאריך","שם","טלפון","מייל","הכנסה נטו","התחייבויות","הון עצמי","סוג נכס","משכנתה אפשרית","שווי נכס מקסימלי","החזר חודשי","אישור שליחה"];

function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput("forbidden");
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  sh.appendRow([new Date(), d.name, "'" + d.phone, d.email, d.income, d.obligations,
    d.equity, d.deal, d.maxMortgage, d.maxPrice,
    d.monthlyPayment, d.consent ? "כן" : "לא"]);
  return ContentService.createTextOutput("ok");
}
```

3. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. העתק את כתובת ה-Web app.
4. ב-Vercel, בפרויקט `tico-lite`, Settings > Environment Variables:
   - `LEAD_WEBHOOK_URL` = הכתובת שהעתקת
   - `LEAD_WEBHOOK_SECRET` = אותה סיסמה כמו ב-SECRET
5. Redeploy.
