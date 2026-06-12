// ==UserScript==
// @name         GeoFS 飞行HUD插件
// @namespace    https://www.geo-fs.com/geofs.php?v=3.9
// @version      5.8.0
// @description  战斗机风格HUD | 颜色自选 | 双数据显示 | 离地高度 | 姿态方向最终修复 | 按L开关
// @author       不宅的飞友
// @match        https://*/*
// @grant        none
// @run-at       document-end
// @license      GPL-3.0
// ==/UserScript==

(function(){
'use strict';

// ==================== 版权与作者信息 ====================
const AUTHOR_NAME = "不宅的飞友";
const AUTHOR_URL = "https://space.bilibili.com/3546664033847377";
const COPYRIGHT = "© 哔哩哔哩 @不宅的飞友 | 开源免费，禁止倒卖 | GitHub: github.com/Shuai-Bi-7365";

console.log(`%c${COPYRIGHT}`, 'color: #4caf50; font-size: 14px; font-weight: bold;');
console.log(`%c🎁 三连打赏UP主: ${AUTHOR_URL}`, 'color: #ff9800; font-size: 12px;');

if(window.__GeoFS_HUD_Copyright && window.__GeoFS_HUD_Copyright !== COPYRIGHT) {
    console.warn('⚠️ 脚本已被修改，请使用原版开源代码');
}
window.__GeoFS_HUD_Copyright = COPYRIGHT;

// ==================== 配置 ====================
let H={
    v:true, x:860, y:100, s:1.4, o:0.5, bg:false,
    spdScroll:1.5, altScroll:0.2,
    pitchStep:5, pitchSpacing:3,
    pre:'center_no_ads',
    mainSpd:'TAS', mainAlt:'MSL',
    mainColor:'#14be00'
};
const P={
    center_no_ads:{name:'无广告中央',getX:(w)=>860,y:100,s:1.4,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.5,bg:false,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL'},
    center_ads:{name:'有广告中央',getX:(w)=>w/2-400,y:80,s:1.0,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.4,bg:true,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL'},
    top_left:{name:'左上角',getX:()=>20,y:80,s:0.9,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.4,bg:true,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL'}
};

let cv=null,ctx=null,panel=null;
let lastVSg=0,lastGt=0,smoothG=1;

function ac(){return window.geofs?.aircraft?.instance}
function isGnd(){try{return ac()?.groundContact===true}catch(e){return false}}
function getX(p){let w=innerWidth;return P[p]?.getX?.(w)||860}

function load(){
    try{
        let s=localStorage.getItem('geoFS_hud');
        if(s){
            let loaded = JSON.parse(s);
            Object.assign(H, loaded);
        }
    }catch(e){}
    if(H.x===undefined) H.x=860;
    if(H.y===undefined) H.y=100;
    if(H.s===undefined) H.s=1.4;
    if(H.o===undefined) H.o=0.5;
    if(H.bg===undefined) H.bg=false;
    if(H.spdScroll===undefined) H.spdScroll=1.5;
    if(H.altScroll===undefined) H.altScroll=0.2;
    if(H.pitchStep===undefined) H.pitchStep=5;
    if(H.pitchSpacing===undefined) H.pitchSpacing=3;
    if(H.pre===undefined) H.pre='center_no_ads';
    if(H.mainSpd===undefined) H.mainSpd='TAS';
    if(H.mainAlt===undefined) H.mainAlt='MSL';
    if(H.mainColor===undefined) H.mainColor='#14be00';
}
function save(){try{localStorage.setItem('geoFS_hud',JSON.stringify({
    x:H.x,y:H.y,s:H.s,o:H.o,bg:H.bg,spdScroll:H.spdScroll,altScroll:H.altScroll,
    pitchStep:H.pitchStep,pitchSpacing:H.pitchSpacing,pre:H.pre,
    mainSpd:H.mainSpd,mainAlt:H.mainAlt,mainColor:H.mainColor
}))}catch(e){}}

// ==================== 速度函数 ====================
function getTAS(){
    try{
        let a=ac();
        if(!a)return 0;
        let tas=a.trueAirSpeed;
        return tas ? tas*1.94384 : 0;
    }catch(e){return 0}
}
function getGS(){
    try{
        let a=ac();
        if(!a)return 0;
        return (a.velocityScalar || a.groundSpeed || 0)*1.94384;
    }catch(e){return 0}
}
function spdMain(){ return H.mainSpd === 'TAS' ? getTAS() : getGS(); }
function spdSub(){ return H.mainSpd === 'TAS' ? getGS() : getTAS(); }

// ==================== 高度函数 ====================
function getMSL(){
    try{
        let a=ac();
        if(!a)return 0;
        return (a.llaLocation?.[2] || 0)*3.28084;
    }catch(e){return 0}
}
function getAGL(){
    try{
        let a=ac();
        if(!a)return 0;
        let lla = a.llaLocation;
        if(!lla) return 0;
        if(window.geofs?.getGroundAltitude){
            let groundInfo = window.geofs.getGroundAltitude(lla[0], lla[1]);
            let groundAlt = groundInfo?.location?.[2] || groundInfo || 0;
            let agl = (lla[2] - groundAlt) * 3.28084;
            if(agl > 0 && agl < 50000) return agl;
        }
        let relAlt = a.relativeAltitude;
        if(relAlt !== undefined && relAlt > 0) return relAlt * 3.28084;
        return 0;
    }catch(e){return 0}
}
function altMain(){ return H.mainAlt === 'MSL' ? getMSL() : getAGL(); }
function altSub(){ return H.mainAlt === 'MSL' ? getAGL() : getMSL(); }

// ==================== 姿态函数（最终方向修复） ====================
function vs(){try{let a=ac();return (a?.velocity?.[2]||0)*196.85}catch(e){return 0}}
function pitch(){
    try{
        let a = ac();
        // 取反：使拉杆（抬头）为正，推杆（低头）为负
        return -(a?.htr?.[1] || 0);
    }catch(e){return 0}
}
function roll(){
    try{
        let a = ac();
        return a?.htr?.[2] || 0;
    }catch(e){return 0}
}
function hdg(){try{let a=ac(),h=a?.htr?.[0]||0;while(h<0)h+=360;while(h>=360)h-=360;return h}catch(e){return 0}}
function gForce(){
    let a=ac();if(!a)return 1;
    let n=Date.now(),v=Math.abs(vs()),g=1;
    if(lastGt){let dt=(n-lastGt)/1000;if(dt>0&&dt<0.2){let ch=(v-lastVSg)/196.85,acc=ch/dt;g=1+acc/9.8;if(g>5)g=5;if(g<0.5)g=0.5;smoothG=smoothG*0.6+g*0.4;g=smoothG}}
    lastVSg=v;lastGt=n;return g;
}
function thrust(){try{let a=ac(),r=a?.engine?.rpm||0;return Math.min(100,Math.round(r/10000*100))}catch(e){return 0}}

function draw(){
    if(!cv||!ctx||!H.v)return;
    cv.width=innerWidth;cv.height=innerHeight;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.save();
    ctx.translate(H.x,H.y);
    ctx.scale(H.s,H.s);
    ctx.globalAlpha=H.o;

    let s=spdMain(),a=altMain(),vs_=vs(),p=pitch(),r=roll(),hd=hdg(),g=gForce(),t=thrust();
    let cx=300,cy=200;

    // 倾斜角表盘
    ctx.save();
    ctx.translate(cx,55);
    ctx.strokeStyle=H.mainColor;
    ctx.lineWidth=1.5;
    ctx.fillStyle=H.mainColor;
    ctx.font='11px monospace';
    ctx.textAlign='center';
    ctx.globalAlpha=H.o;
    ctx.beginPath();ctx.ellipse(0,0,100,45,0,Math.PI,2*Math.PI);ctx.stroke();
    for(let deg=-60;deg<=60;deg+=10){
        let rad=deg*Math.PI/180,x=100*Math.sin(rad),y=-45*Math.cos(rad);
        if(deg===0){
            ctx.moveTo(x,y);ctx.lineTo(x*0.85,y*0.85);ctx.stroke();
            ctx.fillText('0',x*0.7,y*0.7-3);
        }else if(Math.abs(deg)%20===0){
            ctx.moveTo(x,y);ctx.lineTo(x*0.8,y*0.8);ctx.stroke();
            ctx.fillText(deg,x*0.65,y*0.65-3);
        }else{
            ctx.moveTo(x,y);ctx.lineTo(x*0.9,y*0.9);ctx.stroke();
        }
    }
    let rc=Math.min(60,Math.max(-60,r)),rad=rc*Math.PI/180;
    let ax=100*0.92*Math.sin(rad),ay=-45*0.92*Math.cos(rad);
    ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(ax-6,ay+10);ctx.lineTo(ax+6,ay+10);ctx.fill();
    ctx.restore();

    // 空速带
    ctx.save();
    if(H.bg){ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(25,cy-100,120,200);}
    ctx.fillStyle=H.mainColor;
    ctx.strokeStyle=H.mainColor;
    ctx.font='14px monospace';
    ctx.textAlign='right';
    ctx.shadowBlur=0;
    for(let sp=10;sp<=1000;sp+=10){
        let y=cy+(s-sp)*H.spdScroll;
        if(y<cy-80||y>cy+80)continue;
        let a2=Math.max(0.4,1-Math.abs(sp-s)/50);
        ctx.globalAlpha=H.o*a2;
        ctx.fillText(sp,100,y+5);
        ctx.fillRect(105,y,sp===Math.round(s/10)*10?35:20,1.5);
    }
    ctx.globalAlpha=H.o;
    ctx.font='bold 34px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.fillText(Math.round(s),50,cy+10);
    ctx.font='12px monospace';
    ctx.fillText('kt',115,cy+10);
    // 副速度显示
    ctx.font='12px monospace';
    ctx.textAlign='left';
    let subSpd = spdSub();
    let subLabel = H.mainSpd === 'TAS' ? 'GS' : 'TAS';
    ctx.fillText(`${subLabel}: ${Math.round(subSpd)}`, 50, cy+40);
    ctx.restore();

    // 高度带
    ctx.save();
    if(H.bg){ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(460,cy-120,130,240);}
    ctx.fillStyle=H.mainColor;
    ctx.strokeStyle=H.mainColor;
    ctx.font='14px monospace';
    ctx.textAlign='left';
    for(let al=200;al<=50000;al+=200){
        let y=cy+(a-al)*H.altScroll;
        if(y<cy-110||y>cy+110)continue;
        let a2=Math.max(0.4,1-Math.abs(al-a)/200);
        ctx.globalAlpha=H.o*a2;
        ctx.fillText(al,510,y+5);
        ctx.fillRect(485,y,al===Math.round(a/200)*200?35:20,1.5);
    }
    for(let al=100;al<=50000;al+=100){
        if(al%200===0)continue;
        let y=cy+(a-al)*H.altScroll;
        if(y<cy-110||y>cy+110)continue;
        ctx.fillRect(490,y,10,1);
    }
    ctx.globalAlpha=H.o;
    ctx.font='bold 34px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.fillText(Math.round(a),540,cy+10);
    ctx.font='12px monospace';
    ctx.fillText('ft',610,cy+10);
    // 副高度显示
    let subAlt = altSub();
    let subAltLabel = H.mainAlt === 'MSL' ? 'AGL' : 'MSL';
    ctx.font='12px monospace';
    ctx.fillText(`${subAltLabel}: ${Math.round(subAlt)}`, 540, cy+40);
    ctx.restore();

    // 姿态仪（方向已校准）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(r * Math.PI / 180);

    // 间距映射：1=原5(最密), 3=标准, 5=最疏
    let spacingMap = [0, 0.7, 0.85, 1.0, 1.15, 1.3];
    let factor = spacingMap[H.pitchSpacing] || 1.0;
    let basePxPerDegree = 3.6;
    let pitchPx = p * factor * basePxPerDegree;
    let lineSpacing = basePxPerDegree * factor;

    ctx.beginPath();
    ctx.strokeStyle = H.mainColor;
    ctx.lineWidth = 1.8;
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = H.mainColor;
    ctx.textAlign = 'center';

    let step = H.pitchStep;
    let bigStep = step * 3;
    for (let d = -90; d <= 90; d += step) {
        // 抬头(p为正)时线向下移动，低头(p为负)时线向上移动
        let y = pitchPx - (d / step) * lineSpacing * step;

        // 渐隐效果
        let distanceFromCenter = Math.abs(y - pitchPx) / 200;
        let alpha = Math.max(0.1, 1 - distanceFromCenter * 0.9);
        if (Math.abs(y) > 160) {
            alpha = Math.max(0, alpha * (1 - (Math.abs(y) - 160) / 40));
        }
        if (Math.abs(y) > 200) continue;

        ctx.globalAlpha = H.o * alpha;

        let len = 28;
        if (d % bigStep === 0) {
            len = 85;
            if (d === 0) len = 110;
        } else {
            len = 45;
        }
        ctx.moveTo(-len, y);
        ctx.lineTo(len, y);
        ctx.stroke();

        if (d !== 0 && d % bigStep === 0) {
            ctx.fillText(d.toString(), -len - 18, y + 4);
            ctx.fillText(d.toString(), len + 18, y + 4);
        }
        if (d === 0) {
            ctx.fillText('0', -85, y - 5);
            ctx.fillText('0', 85, y - 5);
        }
    }
    ctx.globalAlpha = H.o;
    ctx.restore();

    // 十字架
    let crossAlpha = Math.min(1.0, H.o + 0.25);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(-28,0);
    ctx.lineTo(28,0);
    ctx.moveTo(0,-28);
    ctx.lineTo(0,28);
    ctx.strokeStyle=H.mainColor;
    ctx.lineWidth=2.5;
    ctx.globalAlpha=crossAlpha;
    ctx.stroke();
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();
    ctx.arc(0,0,5,0,2*Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation='source-over';
    ctx.restore();

    // 垂直速度/G力/推力
    ctx.save();
    ctx.font='13px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='left';
    ctx.globalAlpha=H.o;
    let vsSign=vs_>0?'+':'';
    ctx.fillText(vsSign+Math.round(Math.abs(vs_))+' fpm',cx-150,cy+90);
    ctx.fillText(g.toFixed(1)+' G',cx-150,cy+115);
    ctx.fillText('推力 '+t+'%',cx+70,cy+115);
    ctx.restore();

    // 航向
    ctx.save();
    ctx.font='bold 22px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='center';
    ctx.globalAlpha=H.o;
    ctx.fillText(Math.round(hd).toString()+'°',cx+200,cy+90);
    ctx.restore();

    // 航向罗盘
    ctx.save();
    ctx.translate(cx,cy+180);
    let cw=340;
    if(H.bg){ctx.fillStyle='rgba(0,0,0,0.4)';ctx.fillRect(-cw/2,-15,cw,30);}
    ctx.font='11px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='center';
    ctx.globalAlpha=H.o;
    let sh=Math.floor(hd/10)*10-80;
    for(let h=sh;h<=sh+160;h+=10){
        let hm=h%360;if(hm<0)hm+=360;
        let x=(h-hd)*2;
        if(Math.abs(x)<cw/2)ctx.fillText(hm,x,0);
    }
    ctx.fillStyle=H.mainColor;
    ctx.beginPath();ctx.moveTo(0,8);ctx.lineTo(-10,20);ctx.lineTo(10,20);ctx.fill();
    ctx.restore();

    // 版本信息
    ctx.save();
    ctx.font='10px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='left';
    ctx.globalAlpha=H.o;
    ctx.fillText('HUD v5.8.0',cx+200,cy+115);
    ctx.restore();

    ctx.restore();
}

function showPanel(){
    if(panel){panel.remove();panel=null;return;}
    panel=document.createElement('div');
    panel.style.cssText='position:fixed;top:20px;left:20px;background:rgba(20,20,35,0.95);backdrop-filter:blur(12px);padding:16px;border-radius:12px;z-index:100010;min-width:340px;border:1px solid #4caf50;color:#fff;';
    panel.innerHTML=`
        <div style="text-align:center;margin-bottom:12px;"><span style="font-size:18px;">⚙️ HUD设置</span></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>预设</span><select id="pre"><option value="center_no_ads">无广告中央</option><option value="center_ads">有广告中央</option><option value="top_left">左上角</option></select></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>X坐标</span><input type="range" id="x_s" min="0" max="1200" step="10" style="flex:1;margin:0 10px;"><input type="number" id="x_n" style="width:70px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Y坐标</span><input type="range" id="y_s" min="0" max="500" step="5" style="flex:1;margin:0 10px;"><input type="number" id="y_n" style="width:70px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>缩放</span><input type="range" id="s_s" min="0.5" max="2.0" step="0.05" style="flex:1;margin:0 10px;"><input type="number" id="s_n" step="0.05" style="width:70px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>透明度</span><input type="range" id="o_s" min="0.3" max="1.0" step="0.05" style="flex:1;margin:0 10px;"><input type="number" id="o_n" step="0.05" style="width:70px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>速度带滚动</span><input type="range" id="spd_s" min="0.5" max="3.0" step="0.1" style="flex:1;margin:0 10px;"><input type="number" id="spd_n" step="0.1" style="width:55px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>高度带滚动(x10)</span><input type="range" id="alt_s" min="0.5" max="5.0" step="0.1" style="flex:1;margin:0 10px;"><input type="number" id="alt_n" step="0.1" style="width:55px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>姿态仪单格角度</span><select id="pitchStep" style="width:80px;"><option value="5" ${H.pitchStep===5?'selected':''}>5度</option><option value="10" ${H.pitchStep===10?'selected':''}>10度</option></select></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>姿态仪线条间距</span><input type="range" id="pitchSpacing" min="1" max="5" step="1" value="${H.pitchSpacing}" style="flex:1;margin:0 10px;"><input type="number" id="pitchSpacingN" step="1" style="width:55px;"></label><div style="font-size:9px;color:#888;">1最密 3标准 5最疏</div></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>背景框</span><input type="checkbox" id="bg" ${H.bg?'checked':''} style="width:20px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>📊 速度带主显示</span><select id="mainSpd" style="width:100px;"><option value="TAS" ${H.mainSpd==='TAS'?'selected':''}>真空速 (TAS)</option><option value="GS" ${H.mainSpd==='GS'?'selected':''}>地速 (GS)</option></select></label><div style="font-size:9px;color:#888;margin-top:-4px;margin-bottom:6px;">另一种速度以小字显示</div></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>🗻 高度带主显示</span><select id="mainAlt" style="width:100px;"><option value="MSL" ${H.mainAlt==='MSL'?'selected':''}>海拔 (MSL)</option><option value="AGL" ${H.mainAlt==='AGL'?'selected':''}>离地 (AGL)</option></select></label><div style="font-size:9px;color:#888;margin-top:-4px;margin-bottom:6px;">另一种高度以小字显示</div></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>🎨 HUD主色</span><input type="color" id="mainColor" value="${H.mainColor}" style="width:60px;"></label></div>
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid #444;text-align:center;font-size:11px;">
            📌 哔哩哔哩 <a href="${AUTHOR_URL}" target="_blank" style="color:#4caf50;text-decoration:none;">@不宅的飞友</a> 制作<br>
            <span style="font-size:9px;color:#888;">开源免费 · 禁止倒卖 · 欢迎分享</span>
        </div>
        <div style="display:flex;gap:10px;margin-top:12px;">
            <button id="reset" style="flex:1;padding:6px;background:#555;border:none;border-radius:5px;color:#fff;cursor:pointer;">重置</button>
            <button id="save" style="flex:1;padding:6px;background:#4caf50;border:none;border-radius:5px;color:#fff;cursor:pointer;">保存并关闭</button>
        </div>
    `;
    document.body.appendChild(panel);

    let preS=document.getElementById('pre'),xS=document.getElementById('x_s'),xN=document.getElementById('x_n'),yS=document.getElementById('y_s'),yN=document.getElementById('y_n');
让SS=文档。getElementById('s_s')，sN=文档。getElementById('s_n')，oS=文档。getElementById('o_s')，oN=文档。getElementById('o_n')；
    let spdS=document.getElementById('spd_s'),spdN=document.getElementById('spd_n'),altS=document.getElementById('alt_s'),altN=document.getElementById('alt_n');
    let pitchStepS=document.getElementById('pitchStep'),pitchSpacingS=document.getElementById('pitchSpacing'),pitchSpacingN=document.getElementById('pitchSpacingN');
    let bgC=document.getElementById('bg');
    let mainSpdS=document.getElementById('mainSpd'),mainAltS=document.getElementById('mainAlt');
    let mainColorC=document.getElementById('mainColor');

    xS.value=H.x;xN.value=H.x;yS.value=H.y;yN.value=H.y;sS.value=H.s;sN.value=H.s;oS.value=H.o;oN.value=H.o;
    spdS.value=H.spdScroll;spdN.value=H.spdScroll;
    altS.value=H.altScroll*10;altN.value=H.altScroll*10;
    pitchStepS.value=H.pitchStep;pitchSpacingS.value=H.pitchSpacing;pitchSpacingN.value=H.pitchSpacing;
    bgC.checked=H.bg;preS.value=H.pre;
    mainSpdS.value=H.mainSpd;mainAltS.value=H.mainAlt;
    mainColorC.value=H.mainColor;

    function upd(){
        H.x=parseInt(xS.value)||0;H.y=parseInt(yS.value)||100;H.s=parseFloat(sS.value)||1.4;H.o=parseFloat(oS.value)||0.5;
        H.spdScroll=parseFloat(spdS.value)||1.5;
        H.altScroll=parseFloat(altS.value)/10||0.2;
        H.pitchStep=parseInt(pitchStepS.value)||5;
        H.pitchSpacing=parseInt(pitchSpacingS.value)||3;
        H.bg=bgC.checked;
        H.mainSpd=mainSpdS.value;
        H.mainAlt=mainAltS.value;
        H.mainColor=mainColorC.value;
        xN.value=H.x;yN.value=H.y;sN.value=H.s;oN.value=H.o;spdN.value=H.spdScroll;altN.value=H.altScroll*10;
        pitchSpacingN.value=H.pitchSpacing;
        H.pre='custom';
        draw();
    }

    xS.oninput=()=>{xN.value=xS.value;upd()};xN.oninput=()=>{xS.value=xN.value;upd()};
    yS.oninput=()=>{yN.value=yS.value;upd()};yN.oninput=()=>{yS.value=yN.value;upd()};
    sS.oninput=()=>{sN.value=sS.value;upd()};sN.oninput=()=>{sS.value=sN.value;upd()};
    oS.oninput=()=>{oN.value=oS.value;upd()};oN.oninput=()=>{oS.value=oN.value;upd()};
    spdS.oninput=()=>{spdN.value=spdS.value;upd()};spdN.oninput=()=>{spdS.value=spdN.value;upd()};
    altS.oninput=()=>{altN.value=altS.value;upd()};altN.oninput=()=>{altS.value=altN.value;upd()};
    pitchStepS.onchange=upd;
    pitchSpacingS.oninput=()=>{pitchSpacingN.value=pitchSpacingS.value;upd()};
    pitchSpacingN.oninput=()=>{pitchSpacingS.value=pitchSpacingN.value;upd()};
    bgC.onchange=upd;
    mainSpdS.onchange=upd;mainAlts.onchange=upd;
    mainColorC.oninput=upd;

    Pres.onchange=(e)=>{
        让 p=e.target.价值;
        如果(P[p]){
            让 预设=P[p];
            让 nx=预设.getX?.(innerWidth)||预设.x;
            xS.价值=nx;xN.价值=nx;
            yS.价值=预设.y;yN.价值=预设.y;
            sS.价值=预设.s;sN.价值=预设.s;
            oS.价值=预设.o;oN.价值=预设.o;
            SPDs.价值=预设.spdScroll;spdn.价值=预设.spdScroll;
            alts.价值=预设.altScroll*10;ALTN.价值=预设.altScroll*10;
            pitchStepS.价值=预设.pitchStep||5;
            pitchSpacingS.价值=预设.间距间距||3;pitchSpacingN.价值=预设.间距间距||3;
            BGC.检查=预设.BG;
mainSpdS.价值=预设.mainSpd||'TAS'；
mainAlts.价值=预设.mainAlt||'MSL'；
mainColorC.价值=预设.mainColor||'#14be00'；
UPD()；H.预=p；
        }
    };

文件。getElementById('重置').onClick=()=>{
让def=P.center_no_ads；
设nx=定义.getx？.(innerWidth)||定义.x；
XS.值=NX；xN.值=NX；yS.值=定义.y；yn.值=定义.y；SS.值=定义.s；sN.值=定义.s；
操作系统。value=定义.O；o ON.值=定义.O；电涌保护器.值=定义.spdScroll；spdn.价值=定义.spdScroll；
alts.价值=定义.altScroll*10；ALTN.值=定义.altScroll*10；
pitchStepS.值=5；pitchSpacingS.值=3；pitchSpacingN.值=3；
BGC.检查=定义.bg；
mainSpdS.价值='TAS'；mainAlts.价值='MSL'；
mainColorC.价值='#14be00'；
UPD()；Pres.价值='center_no_ads'；H.预='center_no_ads'；
    };

文件.getElementById('保存').onClick=()=>{
节省()；
面板.移除()；
面板=null；
    };
}

函数init(){
负载()；
简历=文件。createElement('画布')；简历。身份标识='geo-hud-canvas'；=文件。createElement('画布')；cv.身份标识='geo-hud-canvas'；
资历，风格。cssText='位置：固定；顶部：0；左侧：0；宽度：100%；高度：100%；指针事件：无；z索引：99999；'；
简历.宽度=innerWidth；cv.高度=innerHeight；
CTX=简历.getContext('2d')；文档。身体。appendChild(简历)；
文件.addEventListener('按下键'，(e)=>{
let标记=文件.activeElement？.标记名||"；
如果(标签==='输入'||标签==='TEXTAREA')返回；
如果(e.钥匙==='L'||e.钥匙==='L'){
如果(e.转变键){e.proventDefault()；showPanel()；}
});
其他{e.proventDefault()；H.V=！H.v；如果(简历)简历.风格。显示=H.V？'块'：'无'；}
}
如果(e.转变键){e.proventDefault()；showPanel()；}
窗户。addEventListener('调整大小'，()=>{如果(简历){简历.宽度=innerWidth；cv.高度=innerHeight}如果(H.预&&P[H.预]){H.X=P[H.预].getx？.(innerWidth)||P[H.预].x；保存()}})；
(函数Anim(){画()；requestAnimationFrame(Anim)})()；函数Anim(){画()；requestAnimationFrame(Anim)})()；
控制台.日志('%c${COPYRIGHT}'，'color：#4caf50；font-size:14px；font-weight:bold；')；.日志('%c${COPYRIGHT}'，'color：#4caf50；font-size:14px；font-weight:bold；')；
控制台.'L'('%cGeoFSHUDV5.8.0|姿态方向最终修复|拉杆抬头线向下'，'color：#ff9800；font-大小:12px；')；.日志('%cGeoFSHUDV5.8.0|姿态方向最终修复|拉杆抬头线向下'，'color：#ff9800；font-大小:12px；')；
}
功能wait(){交流电()？初始化()：setTimeout(等等，500)}等待(){交流电()？初始化()：setTimeout(等等，500)}等待()；
})();)();)();)();
