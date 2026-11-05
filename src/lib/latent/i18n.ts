"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Language = "en" | "roman_urdu" | "urdu";

// Translation dictionary — English (default) + Roman Urdu
// Urdu RTL needs a separate font + direction handling (stubbed)
type Dict = Record<string, { en: string; roman_urdu: string; urdu: string }>;

const dict: Dict = {
  // Task 116 — beta experience
  "nav.beta": { en: "Beta Experience", roman_urdu: "Beta Experience", urdu: "بیٹا تجربہ" },
  "beta.common.back": { en: "Back", roman_urdu: "Wapas", urdu: "واپس" },
  "beta.common.skip": { en: "Skip", roman_urdu: "Skip karein", urdu: "چھوڑیں" },
  "beta.common.restart": { en: "Restart", roman_urdu: "Dobara shuru", urdu: "دوبارہ شروع" },
  "beta.common.refresh": { en: "Refresh", roman_urdu: "Refresh", urdu: "ریفریش" },
  "beta.common.saving": { en: "Saving…", roman_urdu: "Save ho raha hai…", urdu: "محفوظ ہو رہا ہے…" },
  "beta.onboarding.enter": { en: "Enter the beta dashboard", roman_urdu: "Beta dashboard kholein", urdu: "بیٹا ڈیش بورڈ کھولیں" },
  "beta.onboarding.disabled": { en: "The beta experience is currently disabled.", roman_urdu: "Beta experience filhaal band hai.", urdu: "بیٹا تجربہ فی الحال بند ہے۔" },
  "beta.onboarding.app_available": { en: "The regular Latent.pk application remains fully available.", roman_urdu: "Mamooli Latent.pk app poori tarah chalta rahega.", urdu: "باہر کی باقاعدہ Latent.pk ایپلیکیشن مکمل طور پر دستیاب رہے گی۔" },
  "beta.onboarding.back_to_app": { en: "Back to Latent.pk", roman_urdu: "Latent.pk par wapas", urdu: "Latent.pk پر واپس" },
  "beta.dashboard.title": { en: "Beta research dashboard", roman_urdu: "Beta research dashboard", urdu: "بیٹا ریسرچ ڈیش بورڈ" },
  "beta.dashboard.banner": { en: "BETA RESEARCH — not an order, not guaranteed returns, not personalized regulated investment advice.", roman_urdu: "BETA RESEARCH — order nahi, guaranteed return nahi, regulated mashwara nahi.", urdu: "بیٹا ریسرچ — آرڈر نہیں، ضمانت شدہ منافع نہیں، ذاتی باقاعدہ سرمایہ کاری مشورہ نہیں۔" },
  "beta.dashboard.banner_sub": { en: "Research results are still being validated. No model or strategy has passed independent promotion requirements. This beta does not place broker orders.", roman_urdu: "Research results abhi validate ho rahe hain. Koi model promotion requirements pass nahi kar saka. Ye beta broker orders nahi deta.", urdu: "ریسرچ نتائج ابھی جانچے جا رہے ہیں۔ کوئی ماڈل خود مختار فروغ کی شرائط پاس نہیں کر سکا۔ یہ بیٹا بروکر آرڈرز نہیں دیتا۔" },
  "beta.dashboard.advanced": { en: "Advanced view", roman_urdu: "Advanced view", urdu: "جدید منظر" },
  "beta.dashboard.market_overview": { en: "Market overview", roman_urdu: "Market jaiza", urdu: "مارکیٹ جائزہ" },
  "beta.dashboard.data_frontier": { en: "Verified data frontier", roman_urdu: "Verified data frontier", urdu: "تصدیق شدہ ڈیٹا سرحد" },
  "beta.dashboard.verified_bars": { en: "Verified bars", roman_urdu: "Verified bars", urdu: "تصدیق شدہ بارز" },
  "beta.dashboard.provider": { en: "Data provider", roman_urdu: "Data provider", urdu: "ڈیٹا فراہم کنندہ" },
  "beta.dashboard.last_update": { en: "Last update", roman_urdu: "Aakhri update", urdu: "آخری اپ ڈیٹ" },
  "beta.dashboard.research_facts": { en: "Current research facts (must stay visible)", roman_urdu: "Moooda research haqaiq", urdu: "موجودہ ریسرچ حقائق" },
  "beta.dashboard.profile_incomplete": { en: "Profile incomplete", roman_urdu: "Profile mukammal nahi", urdu: "پروفائل نامکمل" },
  "beta.dashboard.profile_incomplete_sub": { en: "Your risk answers are incomplete or conflict — no precise risk score is generated. This is intentional.", roman_urdu: "Aapke risk jawabat mukammal nahi ya mutazaad hain — koi precise score nahi banaya jata.", urdu: "آپ کے رسک جوابات نامکمل یا متضاد ہیں — کوئی درست سکور نہیں بنایا جاتا۔ یہ جان بوجھ کر ہے۔" },
  "beta.dashboard.review_profile": { en: "Review your profile", roman_urdu: "Apni profile dekhein", urdu: "اپنا پروفائل دیکھیں" },
  "beta.dashboard.llm_agreement": { en: "LLM agreement", roman_urdu: "LLM ittefaq", urdu: "ایل ایل ایم اتفاق" },
  "beta.dashboard.not_an_order": { en: "SHADOW / BETA RESEARCH — NOT AN ORDER", roman_urdu: "SHADOW / BETA RESEARCH — ORDER NAHI", urdu: "شیڈو / بیٹا ریسرچ — آرڈر نہیں" },
  "beta.dashboard.strategy_breakdown": { en: "Strategy breakdown", roman_urdu: "Strategy tafseel", urdu: "حکمتِ عملی کی تفصیل" },
  "beta.dashboard.strategy_inventory": { en: "All 12 strategy components (methodology & restrictions)", roman_urdu: "Tamam 12 strategy ajza", urdu: "تمام ۱۲ حکمتِ عملی اجزاء" },
  "beta.dashboard.llm_analyst": { en: "GLM-4.6 LLM analyst", roman_urdu: "GLM-4.6 LLM analyst", urdu: "GLM-4.6 ایل ایل ایم تجزیہ کار" },
  "beta.dashboard.llm_role": { en: "The AI analyst explains evidence and conflicts. It never overrides strategy calculations and never produces a win probability. Performance not available — insufficient matured outcomes.", roman_urdu: "AI analyst saboot aur tanazaat samjhata hai. Ye strategy calculations override nahi karta aur win probability nahi banata.", urdu: "اے آئی تجزیہ کار ثبوت اور تضادات وضاحت کرتا ہے۔ یہ حکمتِ عملی کی حساب کتاب کو کبھی ختم نہیں کرتا اور جیت کا امکان نہیں بناتا۔" },
  "beta.dashboard.open_llm_signals": { en: "Open the full LLM Signals page", roman_urdu: "Poora LLM Signals page kholein", urdu: "مکمل LLM اشارات صفحہ کھولیں" },
  "beta.dashboard.llm_uncalibrated": { en: "LLM conviction is uncalibrated.", roman_urdu: "LLM conviction uncalibrated hai.", urdu: "ایل ایل ایم لیکننگ غیر معیاری ہے۔" },
  "beta.dashboard.risk_education": { en: "Risk & education", roman_urdu: "Risk aur taleem", urdu: "رسک اور تعلیم" },
  "beta.dashboard.risk_education_body": { en: "Deterministic hypothetical risk levels come from the frozen atr14-1.5-1-2-3 policy and the V2 cost engine. They are illustrations — never orders, never leverage, never short entries.", roman_urdu: "Deterministic hypothetical risk levels frozen policy se aate hain. Ye sirf illustrations hain — order nahi, leverage nahi, short entry nahi.", urdu: "متعین مفروضہ رسک لیول منجمد پالیسی سے آتے ہیں۔ یہ محض مثالیں ہیں — آرڈر نہیں، لیوریج نہیں، شارٹ انٹری نہیں۔" },

  // Task 117 Part C — invitation gate
  "beta.enter.title": { en: "Latent.pk controlled beta — invitation required", roman_urdu: "Latent.pk beta — dawat zaroori hai", urdu: "Latent.pk بیٹا — دعوت ضروری ہے" },
  "beta.enter.subtitle": { en: "The beta is currently invite-only. Enter the invitation code your operator gave you. Codes work a limited number of times and may expire.", roman_urdu: "Beta filhaal sirf dawat par hai. Operator ka diya hua invitation code daalein. Codes mehdood times chalte hain aur expire ho sakte hain.", urdu: "بیٹا فی الحال صرف دعوت پر ہے۔ اپنا دعوتی کوڈ درج کریں۔ کوڈز محدود تعداد میں کام کرتے ہیں اور میعاد ختم ہو سکتی ہے۔" },
  "beta.enter.submit": { en: "Redeem invitation", roman_urdu: "Invitation istemal karein", urdu: "دعوت استعمال کریں" },
  "beta.enter.invalid": { en: "This invitation is not valid or is no longer active. Please check the code with your operator and try again.", roman_urdu: "Ye invitation durust nahi ya ab active nahi. Operator se code check karke dobara koshish karein.", urdu: "یہ دعوت درست نہیں یا اب فعال نہیں۔ براہ کرم آپریٹر سے کوڈ چیک کر کے دوبارہ کوشش کریں۔" },
  "beta.enter.invalid_urdu": { en: "یہ دعوت درست نہیں یا اب فعال نہیں۔", roman_urdu: "Ye invitation durust nahi.", urdu: "یہ دعوت درست نہیں یا اب فعال نہیں۔" },
  "beta.enter.closed": { en: "The beta is currently closed. Please check back later.", roman_urdu: "Beta filhaal band hai. Baad mein dobara dekhein.", urdu: "بیٹا فی الحال بند ہے۔ براہ کرم بعد میں دوبارہ دیکھیں۔" },
  "beta.enter.closed_title": { en: "Beta is closed", roman_urdu: "Beta band hai", urdu: "بیٹا بند ہے" },
  "beta.enter.privacy_note": { en: "Invitations are validated on the server. Redeeming creates an anonymous profile — no name, email, phone or CNIC is collected.", roman_urdu: "Invitations server par validate hote hain. Redeem karne par anonymous profile banti hai — koi naam, email, phone ya CNIC nahi.", urdu: "دعوتیں سرور پر جانچی جاتی ہیں۔ دعوت استعمال کرنے سے گمنام پروفائل بنتا ہے — کوئی نام، ای میل، فون یا شناختی کارڈ نمبر نہیں لیا جاتا۔" },

  // Task 117 Part I1 — welcome panel
  "beta.welcome.title": { en: "Welcome — your beta at a glance", roman_urdu: "Khush aamdeed — aapka beta ek nazar mein", urdu: "خوش آمدید — آپ کا بیٹا ایک نظر میں" },
  "beta.welcome.how_link": { en: "How Latent works (plain language)", roman_urdu: "Latent kaise kaam karta hai", urdu: "لیٹنٹ کیسے کام کرتا ہے" },
  "beta.welcome.prefs": { en: "Your saved research preferences", roman_urdu: "Aapki mehfooz research pasand", urdu: "آپ کی محفوظ ریسرچ ترجیحات" },
  "beta.welcome.objective": { en: "Objective", roman_urdu: "Maqsad", urdu: "مقصد" },
  "beta.welcome.horizon": { en: "Horizon", roman_urdu: "Muddat", urdu: "مدت" },
  "beta.welcome.watchlist": { en: "Watchlist", roman_urdu: "Watchlist", urdu: "واچ لسٹ" },
  "beta.welcome.default_universe": { en: "default liquid universe", roman_urdu: "default liquid universe", urdu: "پہلے سے طے شدہ لیکویڈ یونیورس" },
  "beta.welcome.shariah": { en: "Shariah screening", roman_urdu: "Shariah screening", urdu: "شریعہ اسکریننگ" },
  "beta.welcome.data_status": { en: "Current market/data status", roman_urdu: "Moooda market/data surat-e-hal", urdu: "موجودہ مارکیٹ/ڈیٹا صورتحال" },
  "beta.welcome.freshness_note": { en: "Every research card shows its own source bar date. Anything older than the frontier is labelled.", roman_urdu: "Har research card apni source date dikhata hai. Purana data label hota hai.", urdu: "ہر ریسرچ کارڈ اپنی ڈیٹا تاریخ دکھاتا ہے۔ پرانا ڈیٹا لیبل کیا جاتا ہے۔" },
  "beta.welcome.risk_title": { en: "Risk facts (always true here)", roman_urdu: "Risk haqaiq (hamesha)", urdu: "رسک حقائق (ہمیشہ)" },
  "beta.welcome.risk_body": { en: "Research only — nothing here is an order. No strategy is performance-validated; LLM conviction is uncalibrated; past results never guarantee future returns; you are responsible for your decisions.", roman_urdu: "Sirf research — yahan koi order nahi. Koi strategy performance-validated nahi; LLM conviction uncalibrated; guzrishtey results mustaqbil ki guarantee nahi; faisla aapka.", urdu: "صرف ریسرچ — یہاں کوئی آرڈر نہیں۔ کوئی حکمتِ عملی کارکردگی کی تصدیق شدہ نہیں؛ ایل ایل ایم لیکننگ غیر معیاری؛ ماضی کے نتائج مستقبل کی ضمانت نہیں؛ فیصلہ آپ کا۔" },

  // Task 117 Part I3 — LLM panel additions
  "beta.llm.cutoff": { en: "evidence cutoff", roman_urdu: "saboot cutoff", urdu: "ثبوت کی حد" },
  "beta.llm.unavailable_note": { en: "For some watchlist symbols no stored GLM-4.6 decision exists — those panels say so instead of inventing one.", roman_urdu: "Kuch symbols ke liye koi stored GLM-4.6 faisla nahi — panel saaf likhta hai.", urdu: "کچھ علامتوں کے لیے کوئی محفوظ GLM-4.6 فیصلہ نہیں — پینل صاف بتاتا ہے۔" },

  // Task 117 Part I4 — feedback
  "beta.feedback.title": { en: "Beta feedback (goes straight to the operator)", roman_urdu: "Beta feedback (seedha operator tak)", urdu: "بیٹا فیڈبیک (براہ راست آپریٹر تک)" },
  "beta.feedback.intro": { en: "Tell us what is confusing, wrong, stale or broken. No personal details required — please do not include CNIC, passwords or account numbers.", roman_urdu: "Bataein kya mushkil, ghalat, purana ya toota hua hai. Zaati tafseel zaroori nahi — CNIC, password ya account number na likhein.", urdu: "بتائیں کیا مشکل، غلط، پرانا یا ٹوٹا ہوا ہے۔ ذاتی تفصیل ضروری نہیں — شناختی کارڈ، پاس ورڈ یا اکاؤنٹ نمبر نہ لکھیں۔" },
  "beta.feedback.category": { en: "Category", roman_urdu: "Category", urdu: "قسم" },
  "beta.feedback.cat.confusing_info": { en: "Confusing information", roman_urdu: "Mushkil maloomat", urdu: "پیچیدہ معلومات" },
  "beta.feedback.cat.incorrect_company_data": { en: "Incorrect company data", roman_urdu: "Ghalat company data", urdu: "غلط کمپنی ڈیٹا" },
  "beta.feedback.cat.stale_prices": { en: "Stale prices / data", roman_urdu: "Purane prices / data", urdu: "پرانے ریٹس / ڈیٹا" },
  "beta.feedback.cat.broken_interface": { en: "Broken interface", roman_urdu: "Toota hua interface", urdu: "خراب انٹرفیس" },
  "beta.feedback.cat.missing_feature": { en: "Missing feature", roman_urdu: "Koi feature nahi", urdu: "کوئی فیچر نہیں" },
  "beta.feedback.cat.general": { en: "General feedback", roman_urdu: "Aam raye", urdu: "عمومی رائے" },
  "beta.feedback.message": { en: "Message", roman_urdu: "Paigham", urdu: "پیغام" },
  "beta.feedback.placeholder": { en: "e.g. The MEBL card shows data from 3 days ago even though the frontier is newer.", roman_urdu: "Misaal: MEBL card purani data dikha raha hai.", urdu: "مثال: MEBL کارڈ پرانا ڈیٹا دکھا رہا ہے۔" },
  "beta.feedback.send": { en: "Send feedback", roman_urdu: "Bhejein", urdu: "بھیجیں" },
  "beta.feedback.error": { en: "Feedback could not be saved. Please try again shortly.", roman_urdu: "Feedback save nahi hua. Thori dair baad koshish karein.", urdu: "فیڈبیک محفوظ نہیں ہوا۔ براہ کرم تھوڑی دیر بعد کوشش کریں۔" },

  // Task 117 Part D — privacy panel
  "beta.privacy.title": { en: "Your data & privacy", roman_urdu: "Aapka data aur privacy", urdu: "آپ کا ڈیٹا اور پرائیویسی" },
  "beta.privacy.disclosure": { en: "Saved on this device: your beta profile is an ANONYMOUS profile tied to a cookie in this browser only. It is not a verified personal account, it is not synced across devices, and it is never public.", roman_urdu: "Is device par mehfooz: aapki beta profile sirf is browser ke cookie se judi anonymous profile hai. Ye verified account nahi, devices par sync nahi hoti, aur public nahi hai.", urdu: "اس ڈیوائس پر محفوظ: آپ کی بیٹا پروفائل صرف اس براؤزر کے کوکی سے جڑی گمنام پروفائل ہے۔ یہ تصدیق شدہ اکاؤنٹ نہیں، ڈیوائسز پر سنک نہیں ہوتی، اور عوامی نہیں ہے۔" },
  "beta.privacy.consent_version": { en: "Consent version you accepted", roman_urdu: "Aapka qubool kiya consent version", urdu: "آپ کا قبول کردہ کنسینٹ ورژن" },
  "beta.privacy.consent_accepted": { en: "Consent accepted on", roman_urdu: "Consent qubool kiya", urdu: "کنسینٹ قبول کیا" },
  "beta.privacy.collect_note": { en: "Collected: your onboarding answers only. Never collected: CNIC, broker credentials, passwords, bank details, account numbers.", roman_urdu: "Liya jata hai: sirf aapke onboarding jawabat. Kabhi nahi: CNIC, broker credentials, password, bank tafseel.", urdu: "لیا جاتا ہے: صرف آپ کے آن بورڈنگ جوابات۔ کبھی نہیں: شناختی کارڈ، بروکر اسناد، پاس ورڈ، بینک تفصیلات۔" },
  "beta.privacy.edit": { en: "Edit answers", roman_urdu: "Jawabat badlein", urdu: "جوابات بدلیں" },
  "beta.privacy.reset": { en: "Reset onboarding", roman_urdu: "Onboarding reset karein", urdu: "آن بورڈنگ ری سیٹ کریں" },
  "beta.privacy.delete": { en: "Delete beta profile", roman_urdu: "Beta profile delete karein", urdu: "بیٹا پروفائل حذف کریں" },
  "beta.privacy.reset_confirm": { en: "Reset onboarding? Your current identity is invalidated and you will get a fresh one (your invitation access is kept).", roman_urdu: "Onboarding reset? Mojooda identity khatam hogi aur nayi milegi (invitation access barqarar).", urdu: "آن بورڈنگ ری سیٹ؟ موجودہ شناخت ختم ہوگی اور نئی ملے گی (دعوتی رسائی برقرار)۔" },
  "beta.privacy.delete_confirm": { en: "Delete your beta profile? The server-side record is removed and this browser's cookie is cleared. This cannot be undone.", roman_urdu: "Beta profile delete? Server record hat jayega aur is browser ki cookie saaf ho jayegi. Wapas nahi aayega.", urdu: "بیٹا پروفائل حذف کریں؟ سرور ریکارڈ ہٹ جائے گا اور اس براؤزر کی کوکی صاف ہو جائے گی۔ واپس نہیں آئے گا۔" },

  // Nav
  "nav.dashboard": { en: "Dashboard", roman_urdu: "Dashboard", urdu: "ڈیش بورڈ" },
  "nav.fundamental_news": { en: "Fundamental News", roman_urdu: "Bunyadi Khabrein", urdu: "بنیادی خبریں" },
  "nav.technical_analysis": { en: "Technical Analysis", roman_urdu: "Technical Tajzea", urdu: "تکنیکی تجزیہ" },
  "nav.signals": { en: "Signals", roman_urdu: "Signals", urdu: "اشارات" },
  "nav.portfolio": { en: "Portfolio", roman_urdu: "Portfolio", urdu: "پورٹفولیو" },
  "nav.strategy": { en: "Strategy", roman_urdu: "Strategy", urdu: "حکمتِ عمل" },
  "nav.dividends": { en: "Dividends", roman_urdu: "Dividends", urdu: "ڈیویڈنڈ" },
  "nav.tracker": { en: "Tracker", roman_urdu: "Tracker", urdu: "ٹریکر" },
  "nav.golden_cross": { en: "Golden Cross 7/30", roman_urdu: "Golden Cross 7/30", urdu: "گولڈن کراس 7/30" },
  "nav.volatility_analytics": { en: "Volatility Analytics", roman_urdu: "Volatility Tajzea", urdu: "وولیٹیلٹی تجزیہ" },
  "nav.ai_analysis": { en: "AI Analysis", roman_urdu: "AI Tajzea", urdu: "اے آئی تجزیہ" },
  "nav.llm_signals": { en: "LLM Signals", roman_urdu: "LLM Signals", urdu: "ایل ایل ایم اشارات" },
  "nav.model_report": { en: "Model Performance", roman_urdu: "Model Performance", urdu: "ماڈل کارکردگی" },
  "nav.ai_model_signals": { en: "AI Models", roman_urdu: "AI Models", urdu: "اے آئی ماڈلز" },
  "nav.paper_monitor": { en: "Paper Trade Monitor", roman_urdu: "Paper Trade Monitor", urdu: "پیپر ٹریڈ مانیٹر" },
  "nav.calculators": { en: "Calculators", roman_urdu: "Calculators", urdu: "کیلکولیٹرز" },
  "nav.pattern_finder": { en: "Pattern Finder", roman_urdu: "Pattern Finder", urdu: "پیٹرن فائنڈر" },

  // Common
  "common.loading": { en: "Loading...", roman_urdu: "Lodaing ho raha hai...", urdu: "لوڈ ہو رہا ہے..." },
  "common.error": { en: "Something went wrong", roman_urdu: "Kuch masla ho gaya", urdu: "کوئی مسئلہ ہو گیا" },
  "common.view_detail": { en: "View detail", roman_urdu: "Tafseel dekhein", urdu: "تفصیل دیکھیں" },
  "common.execute": { en: "Execute", roman_urdu: "Execute", urdu: "ایکزیکیوٹ" },
  "common.back": { en: "Back", roman_urdu: "Wapas", urdu: "واپس" },
  "common.refresh": { en: "Refresh", roman_urdu: "Refresh", urdu: "ریفریش" },
  "common.all": { en: "All", roman_urdu: "Sab", urdu: "سب" },
  "common.search": { en: "Search", roman_urdu: "Search", urdu: "تلاش" },

  // Signal
  "signal.buy": { en: "BUY", roman_urdu: "KHAREEDAIN", urdu: "خریدیں" },
  "signal.sell": { en: "SELL", roman_urdu: "BECHEIN", urdu: "بیچیں" },
  "signal.hold": { en: "HOLD", roman_urdu: "HOLD", urdu: "ہولڈ" },
  "signal.accumulate": { en: "ACCUMULATE", roman_urdu: "JAMA KAREin", urdu: "جمع کریں" },
  "signal.confidence": { en: "Confidence", roman_urdu: "Confidence", urdu: "اعتماد" },

  // News
  "news.international_national": { en: "International & National", roman_urdu: "International aur National", urdu: "بین الاقوامی و قومی" },
  "news.company_news": { en: "Company News", roman_urdu: "Company Khabrein", urdu: "کمپنی خبریں" },
  "news.company_results": { en: "Company Results", roman_urdu: "Company Natijay", urdu: "کمپنی نتائج" },
  "news.remarks": { en: "Remarks", roman_urdu: "Tabsara", urdu: "تبصرہ" },
  "news.impact": { en: "Impact", roman_urdu: "Asar", urdu: "اثر" },
  "news.affected_stocks": { en: "Affected stocks", roman_urdu: "Mutruisht stocks", urdu: "متاثرہ اسٹاکس" },
  "news.open_signal": { en: "Open signal", roman_urdu: "Signal kholain", urdu: "اشارہ کھولیں" },
  "news.view_pdf": { en: "View PDF", roman_urdu: "PDF dekhein", urdu: "پی ڈی ایف دیکھیں" },
  "news.interpret_link": { en: "Interpret a news link", roman_urdu: "News link interpret karein", urdu: "نیوز لنک کی تشریح کریں" },
  "news.paste_link": { en: "Paste any news article URL to get an AI interpretation", roman_urdu: "AI interpretation ke luye koi bhi news article URL paste karein", urdu: "اے آئی تشریح کے لیے کوئی بھی نیوز آرٹیکل یو آر ایل پیسٹ کریں" },

  // Portfolio
  "portfolio.add_stock": { en: "Add stock", roman_urdu: "Stock add karein", urdu: "اسٹاک شامل کریں" },
  "portfolio.empty": { en: "No stocks in your portfolio yet", roman_urdu: "Aap ke portfolio mein abhi koi stock nahi", urdu: "آپ کے پورٹفولیو میں ابھی کوئی اسٹاک نہیں" },
  "portfolio.hold": { en: "Hold", roman_urdu: "Hold", urdu: "ہولڈ" },
  "portfolio.sell": { en: "Sell", roman_urdu: "Sell", urdu: "بیچیں" },
  "portfolio.buy_more": { en: "Buy more to average", roman_urdu: "Average ke luye aur khareedain", urdu: "اوسط کے لیے مزید خریدیں" },
  "portfolio.profit": { en: "Profit", roman_urdu: "Profit", urdu: "منافع" },
  "portfolio.loss": { en: "Loss", roman_urdu: "Loss", urdu: "نقصان" },

  // Strategy
  "strategy.goal_question": { en: "What's your investment goal?", roman_urdu: "Aap ki investment maqsad kya hai?", urdu: "آپ کی انویسٹمنٹ مقصد کیا ہے؟" },

  // Tracker
  "tracker.signal_tracker": { en: "Signal Tracker", roman_urdu: "Signal Tracker", urdu: "سگنل ٹریکر" },
  "tracker.portfolio_tracker": { en: "Portfolio Tracker", roman_urdu: "Portfolio Tracker", urdu: "پورٹفولیو ٹریکر" },
  "tracker.win_rate": { en: "Win rate", roman_urdu: "Win rate", urdu: "کامیابی کی شرح" },
  "tracker.roi": { en: "ROI %", roman_urdu: "ROI %", urdu: "آر او آئی %" },

  // Landing
  "landing.cta.build_plan": { en: "Build my plan", roman_urdu: "Apna plan banayein", urdu: "اپنا پلان بنائیں" },
  "landing.cta.explore": { en: "Explore the platform", roman_urdu: "Platform explore karein", urdu: "پلیٹ فارم ایکسپلور کریں" },
};

interface I18nState {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string) => string;
}

export const useI18n = create<I18nState>()(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (l) => set({ lang: l }),
      t: (key: string) => {
        const entry = dict[key];
        if (!entry) return key;
        const lang = get().lang;
        return entry[lang] || entry.en;
      },
    }),
    { name: "latent-i18n" }
  )
);

// Direction helper for RTL
export function getDirection(lang: Language): "ltr" | "rtl" {
  return lang === "urdu" ? "rtl" : "ltr";
}
