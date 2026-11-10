// Styles propres à la vue 3D (canvas plein cadre, étiquettes HTML de la vue éclatée, de la pile de couches et des moitiés),
// injectés une fois pour que le module reste autonome. Ils reprennent les jetons CSS de l'application.
const STYLE_ID = 'k3d-styles';

const CSS = `
:where(.keyboard-3d) { position:absolute; inset:0; overflow:hidden; }
.k3d-canvas { position:absolute; inset:0; width:100%; height:100%; display:block; touch-action:none; outline:none; }
.k3d-canvas.is-hover { cursor:pointer; }
.k3d-canvas.is-paint { cursor:crosshair; }
.k3d-overlay { position:absolute; inset:0; pointer-events:none; overflow:hidden; }
.k3d-leaders { position:absolute; inset:0; width:100%; height:100%; overflow:visible; transition:opacity .3s; }
.k3d-leaders line { stroke:var(--fg, #1d1d1f); stroke-opacity:.28; stroke-width:1; }
.k3d-leaders circle { fill:var(--fg, #1d1d1f); }
.k3d-plabel { position:absolute; top:0; left:0; width:max-content; max-width:210px; font-size:12px; line-height:1.3; color:var(--fg, #1d1d1f); }
.k3d-plabel b { display:block; font-weight:600; font-size:13px; letter-spacing:-.01em; }
.k3d-plabel span { color:var(--muted, #6e6e73); }
.k3d-slabel { position:absolute; top:0; left:0; display:flex; align-items:center; gap:7px; height:26px; padding:0 11px 0 9px;
  border-radius:999px; font:inherit; font-size:12px; font-weight:500; white-space:nowrap; cursor:pointer;
  border:.5px solid var(--line, rgba(0,0,0,.08)); background:var(--panel, rgba(255,255,255,.74));
  -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px); color:var(--muted, #6e6e73); }
.k3d-slabel i { width:7px; height:7px; border-radius:50%; background:var(--tint); }
.k3d-slabel.is-cur { color:var(--fg, #1d1d1f); box-shadow:0 0 0 1.5px var(--fg, #1d1d1f); }
.k3d-htag { position:absolute; top:0; left:0; display:flex; align-items:center; gap:7px; height:26px; padding:0 11px 0 9px;
  border-radius:999px; font-size:12px; font-weight:500; white-space:nowrap; color:var(--muted, #6e6e73);
  border:.5px solid var(--line, rgba(0,0,0,.08)); background:var(--panel, rgba(255,255,255,.74));
  -webkit-backdrop-filter:blur(20px); backdrop-filter:blur(20px); transition:opacity .35s; }
.k3d-htag i { width:7px; height:7px; border-radius:50%; background:var(--on, #34c759); flex:none; }
.k3d-htag b { font-weight:600; color:var(--fg, #1d1d1f); }
.k3d-htag.warn i { background:var(--warn, #ff9500); }
@media (max-width: 820px) { .k3d-htag .long { display:none; } }
`;

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.append(style);
}
