*{box-sizing:border-box}
:root{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#eef2f6}
body{margin:0;min-height:100vh;background:linear-gradient(145deg,#eef2f6,#dfe8f1)}
button,input,select,textarea{font:inherit}
.hidden{display:none!important}
.reportShell{min-height:100vh;display:grid;place-items:center;padding:24px}
.reportCard{width:min(760px,100%);background:#fff;border:1px solid #dce4ed;border-radius:24px;padding:26px;box-shadow:0 24px 70px rgba(15,23,42,.12)}
.reportHeader{display:flex;gap:16px;align-items:flex-start;margin-bottom:22px}
.reportMark{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;background:#172033;color:#fff;font-size:28px;font-weight:900;flex:0 0 auto}
.eyebrow{margin:0 0 5px;color:#64748b;text-transform:uppercase;letter-spacing:.08em;font-size:12px;font-weight:800}
h1{margin:0;font-size:clamp(28px,5vw,40px)}
.propertyLine{margin:7px 0 0;color:#475569;line-height:1.45}
.stateBox,.emergencyNotice,.successBox{border-radius:14px;padding:15px;border:1px solid #dbe4ef;background:#f8fafc;color:#475569}
.stateBox.error{border-color:#fecaca;background:#fef2f2;color:#991b1b}
.stateBox span,.emergencyNotice span{display:block;margin-top:4px}
.emergencyNotice{margin-bottom:18px;border-color:#fed7aa;background:#fff7ed;color:#9a3412}
label{display:block;margin-bottom:15px;color:#334155;font-size:13px;font-weight:800}
input,select,textarea{width:100%;margin-top:7px;padding:12px 13px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#172033}
textarea{resize:vertical;min-height:150px}
input:focus,select:focus,textarea:focus{outline:3px solid rgba(23,32,51,.12);border-color:#172033}
.fieldGrid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fieldHelp{display:block;margin-top:5px;color:#64748b;font-size:11px;font-weight:500}
.privacyCheck{display:flex;align-items:flex-start;gap:10px}
.privacyCheck input{width:18px;height:18px;margin:1px 0 0;flex:0 0 auto}
.privacyCheck span{font-weight:600;line-height:1.4}
button{width:100%;border:0;border-radius:12px;padding:13px 16px;background:#172033;color:#fff;font-weight:900;cursor:pointer}
button:disabled{opacity:.55;cursor:not-allowed}
.formMessage{min-height:20px;margin:12px 0 0;color:#b42318;font-size:13px;font-weight:700}
.websiteField{position:absolute!important;left:-10000px!important;width:1px!important;height:1px!important;overflow:hidden!important}
.successBox{text-align:center;border-color:#bbf7d0;background:#f0fdf4;color:#166534}
.successBox h2{margin:9px 0}
.successIcon{width:52px;height:52px;border-radius:50%;margin:auto;display:grid;place-items:center;background:#166534;color:#fff;font-size:28px;font-weight:900}
@media(max-width:640px){
  .reportShell{padding:12px}
  .reportCard{padding:19px;border-radius:18px}
  .fieldGrid{grid-template-columns:1fr}
  .reportHeader{gap:12px}
  .reportMark{width:42px;height:42px}
}
