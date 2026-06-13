// ==UserScript==
// @name         GeoFS 飞行HUD插件
// @namespace    https://www.geo-fs.com/geofs.php?v=3.9
// @version      9.0.0
// @description  战斗机风格HUD | FPV飞行路径矢量 | 自动高度开关 | 帧率可调 | 按L开关
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
    mainColor:'#14be00',
    hudFrameRate:30,
    fpvEnabled:true, fpvScale:0.5, fpvDistance:15, fpvAutoHeight:5000
};
const P={
    center_no_ads:{name:'无广告中央',getX:(w)=>860,y:100,s:1.4,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.5,bg:false,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL',hudFrameRate:30,fpvEnabled:true,fpvScale:0.5,fpvDistance:15,fpvAutoHeight:5000},
    center_ads:{name:'有广告中央',getX:(w)=>w/2-400,y:80,s:1.0,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.4,bg:true,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL',hudFrameRate:30,fpvEnabled:true,fpvScale:0.5,fpvDistance:15,fpvAutoHeight:5000},
    top_left:{name:'左上角',getX:()=>20,y:80,s:0.9,spdScroll:1.5,altScroll:0.2,pitchStep:5,pitchSpacing:3,o:0.4,bg:true,mainColor:'#14be00',mainSpd:'TAS',mainAlt:'MSL',hudFrameRate:30,fpvEnabled:true,fpvScale:0.5,fpvDistance:15,fpvAutoHeight:5000}
};

let cv=null,ctx=null,panel=null;
let lastVSg=0,lastGt=0,smoothG=1;

// FPV 相关变量
let fpvPoint=null;
let lastCameraPos=null;

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
    if(H.hudFrameRate===undefined) H.hudFrameRate=30;
    if(H.fpvEnabled===undefined) H.fpvEnabled=true;
    if(H.fpvScale===undefined) H.fpvScale=0.5;
    if(H.fpvDistance===undefined) H.fpvDistance=15;
    if(H.fpvAutoHeight===undefined) H.fpvAutoHeight=5000;
}
function save(){try{localStorage.setItem('geoFS_hud',JSON.stringify({
    x:H.x,y:H.y,s:H.s,o:H.o,bg:H.bg,spdScroll:H.spdScroll,altScroll:H.altScroll,
    pitchStep:H.pitchStep,pitchSpacing:H.pitchSpacing,pre:H.pre,
    mainSpd:H.mainSpd,mainAlt:H.mainAlt,mainColor:H.mainColor,
    hudFrameRate:H.hudFrameRate,fpvEnabled:H.fpvEnabled,fpvScale:H.fpvScale,fpvDistance:H.fpvDistance,fpvAutoHeight:H.fpvAutoHeight
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

// ==================== 姿态函数 ====================
function vs(){try{let a=ac();return (a?.velocity?.[2]||0)*196.85}catch(e){return 0}}
function pitch(){
    try{
        let a = ac();
        return a?.htr?.[1] || 0;
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

// ==================== FPV 纹理（空心圆 + 十字准星）====================
function createFPVTexture(){
    let canvas=document.createElement('canvas');
    canvas.width=32;
    canvas.height=32;
    let c=canvas.getContext('2d');
    c.clearRect(0,0,32,32);
    // 空心圆
    c.beginPath();
    c.arc(16,16,12,0,2*Math.PI);
    c.strokeStyle=H.mainColor;
    c.lineWidth=2;
    c.stroke();
    // 中心小点
    c.beginPath();
    c.arc(16,16,2,0,2*Math.PI);
    c.fillStyle=H.mainColor;
    c.fill();
    // 十字准星
    c.beginPath();
    c.moveTo(16,4);
    c.lineTo(16,8);
    c.moveTo(16,24);
    c.lineTo(16,28);
    c.moveTo(4,16);
    c.lineTo(8,16);
    c.moveTo(24,16);
    c.lineTo(28,16);
    c.stroke();
    return canvas.toDataURL();
}

// ==================== FPV 初始化 ====================
function initFPV(){
    try{
        let viewer=window.geofs?.api?.viewer;
        if(!viewer||!window.Cesium){setTimeout(initFPV,1000);return;}
        let camLla=geofs.camera?.lla;
        if(!camLla){setTimeout(initFPV,1000);return;}
        let initPos=Cesium.Cartesian3.fromDegrees(camLla[1],camLla[0],camLla[2]);
        fpvPoint=viewer.entities.add({
            position:initPos,
            billboard:{
                image: createFPVTexture(),
                scale:H.fpvScale,
                color:Cesium.Color.fromCssColorString(H.mainColor),
                show:H.fpvEnabled
            }
        });
        lastCameraPos=initPos;
        console.log('FPV已启动');
    }catch(e){console.log('FPV启动失败:',e);}
}

// ==================== FPV 更新（自动高度开关）====================
function updateFPV(){
    if(!fpvPoint){requestAnimationFrame(updateFPV);return;}
    try{
        let camLla=geofs.camera?.lla;
        if(!camLla){requestAnimationFrame(updateFPV);return;}
        
        // 获取离地高度，决定是否显示FPV
        let agl = getAGL();
        let autoShow = (agl < H.fpvAutoHeight && agl > 0);
        let finalShow = H.fpvEnabled && autoShow;
        
        let currPos=Cesium.Cartesian3.fromDegrees(camLla[1],camLla[0],camLla[2]);
        if(lastCameraPos){
            let dx=currPos.x-lastCameraPos.x;
            let dy=currPos.y-lastCameraPos.y;
            let dz=currPos.z-lastCameraPos.z;
            if(Math.abs(dx)>0.01||Math.abs(dy)>0.01||Math.abs(dz)>0.01){
                fpvPoint.position=new Cesium.Cartesian3(
                    currPos.x+H.fpvDistance*dx,
                    currPos.y+H.fpvDistance*dy,
                    currPos.z+H.fpvDistance*dz
                );
            }
        }
        lastCameraPos=currPos;
        if(fpvPoint.billboard){
            fpvPoint.billboard.color=Cesium.Color.fromCssColorString(H.mainColor);
            fpvPoint.billboard.scale=H.fpvScale;
            fpvPoint.show=finalShow;
        }
    }catch(e){}
    requestAnimationFrame(updateFPV);
}

// ==================== HUD 绘制 ====================
function draw(){
    if(!cv||!ctx||!H.v)return;
    cv.width=innerWidth;cv.height=innerHeight;
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.save();
    ctx.translate(H.x,H.y);
    ctx.scale(H.s,H.s);
    ctx.globalAlpha=H.o;

    let s=spdMain(),a=altMain(),vs_=vs(),p=-pitch(),r=roll(),hd=hdg(),g=gForce(),t=thrust();
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
    ctx.font='12px monospace';
    ctx.textAlign='left';
    let subSpd=spdSub();
    let subLabel=H.mainSpd==='TAS'?'GS':'TAS';
    ctx.fillText(`${subLabel}: ${Math.round(subSpd)}`,50,cy+40);
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
    let subAlt=altSub();
    let subAltLabel=H.mainAlt==='MSL'?'AGL':'MSL';
    ctx.font='12px monospace';
    ctx.fillText(`${subAltLabel}: ${Math.round(subAlt)}`,540,cy+40);
    ctx.restore();

    // 姿态仪
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(r*Math.PI/180);
    let spacingMap=[0,0.7,0.85,1.0,1.15,1.3];
    let factor=spacingMap[H.pitchSpacing]||1.0;
    let basePxPerDegree=3.6;
    let pitchPx=p*factor*basePxPerDegree;
    let lineSpacing=basePxPerDegree*factor;
    ctx.beginPath();
    ctx.strokeStyle=H.mainColor;
    ctx.lineWidth=1.8;
    ctx.font='bold 12px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='center';
    let step=H.pitchStep;
    let bigStep=step*3;
    for(let d=-90;d<=90;d+=step){
        let y=pitchPx-(d/step)*lineSpacing*step;
        let distanceFromCenter=Math.abs(y-pitchPx)/200;
        let alpha=Math.max(0.1,1-distanceFromCenter*0.9);
        if(Math.abs(y)>160){alpha=Math.max(0,alpha*(1-(Math.abs(y)-160)/40));}
        if(Math.abs(y)>200)continue;
        ctx.globalAlpha=H.o*alpha;
        let len=28;
        if(d%bigStep===0){len=85;if(d===0)len=110;}
        else{len=45;}
        ctx.moveTo(-len,y);
        ctx.lineTo(len,y);
        ctx.stroke();
        if(d!==0&&d%bigStep===0){
            ctx.fillText(d.toString(),-len-18,y+4);
            ctx.fillText(d.toString(),len+18,y+4);
        }
        if(d===0){
            ctx.fillText('0',-85,y-5);
            ctx.fillText('0',85,y-5);
        }
    }
    ctx.globalAlpha=H.o;
    ctx.restore();

    // 十字架
    let crossAlpha=Math.min(1.0,H.o+0.25);
    ctx.save();
    ctx.translate(cx,cy);
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

    // 其他信息
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

    ctx.save();
    ctx.font='bold 22px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='center';
    ctx.globalAlpha=H.o;
    ctx.fillText(Math.round(hd).toString()+'°',cx+200,cy+90);
    ctx.restore();

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

    ctx.save();
    ctx.font='10px monospace';
    ctx.fillStyle=H.mainColor;
    ctx.textAlign='left';
    ctx.globalAlpha=H.o;
    ctx.fillText('HUD v9.0.0',cx+200,cy+115);
    ctx.restore();

    ctx.restore();
}

// ==================== 设置面板 ====================
function showPanel(){
    if(panel){panel.remove();panel=null;return;}
    panel=document.createElement('div');
    panel.style.cssText='position:fixed;top:20px;left:20px;background:rgba(20,20,35,0.95);backdrop-filter:blur(12px);padding:16px;border-radius:12px;z-index:100010;min-width:380px;border:1px solid #4caf50;color:#fff;';
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
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>⚡ HUD帧率</span><select id="hudFrameRate" style="width:100px;"><option value="10" ${H.hudFrameRate===10?'selected':''}>10 fps</option><option value="20" ${H.hudFrameRate===20?'selected':''}>20 fps</option><option value="30" ${H.hudFrameRate===30?'selected':''}>30 fps</option></select></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>背景框</span><input type="checkbox" id="bg" ${H.bg?'checked':''} style="width:20px;"></label></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>📊 速度带主显示</span><select id="mainSpd" style="width:100px;"><option value="TAS" ${H.mainSpd==='TAS'?'selected':''}>真空速 (TAS)</option><option value="GS" ${H.mainSpd==='GS'?'selected':''}>地速 (GS)</option></select></label><div style="font-size:9px;color:#888;margin-top:-4px;margin-bottom:6px;">另一种速度以小字显示</div></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>🗻 高度带主显示</span><select id="mainAlt" style="width:100px;"><option value="MSL" ${H.mainAlt==='MSL'?'selected':''}>海拔 (MSL)</option><option value="AGL" ${H.mainAlt==='AGL'?'selected':''}>离地 (AGL)</option></select></label><div style="font-size:9px;color:#888;margin-top:-4px;margin-bottom:6px;">另一种高度以小字显示</div></div>
        <div><label style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>🎨 HUD主色</span><input type="color" id="mainColor" value="${H.mainColor}" style="width:60px;"></label></div>
        <div style="margin-top:8px;border-top:1px solid #444;padding-top:8px;">
            <div style="font-weight:bold;margin-bottom:6px;">🎯 飞行路径矢量(FPV)</div>
            <div><label style="display:flex;justify-content:space-between;"><span>启用FPV</span><input type="checkbox" id="fpvEnable" ${H.fpvEnabled?'checked':''}></label></div>
            <div><label style="display:flex;justify-content:space-between;"><span>FPV大小</span><input type="range" id="fpvScale" min="0.3" max="1.2" step="0.05" value="${H.fpvScale}" style="flex:1;margin:0 10px;"><input type="number" id="fpvScaleN" step="0.05" value="${H.fpvScale}" style="width:55px;"></label></div>
            <div><label style="display:flex;justify-content:space-between;"><span>预测距离</span><input type="range" id="fpvDistance" min="5" max="30" step="1" value="${H.fpvDistance}" style="flex:1;margin:0 10px;"><input type="number" id="fpvDistanceN" step="1" value="${H.fpvDistance}" style="width:55px;"></label></div>
            <div><label style="display:flex;justify-content:space-between;"><span>📏 FPV显示高度(英尺)</span><input type="range" id="fpvAutoHeight" min="1000" max="10000" step="500" value="${H.fpvAutoHeight}" style="flex:1;margin:0 10px;"><input type="number" id="fpvAutoHeightN" step="500" value="${H.fpvAutoHeight}" style="width:70px;"></label></div>
            <div style="font-size:9px;color:#888;">低于此高度时自动显示FPV</div>
        </div>
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
    let sS=document.getElementById('s_s'),sN=document.getElementById('s_n'),oS=document.getElementById('o_s'),oN=document.getElementById('o_n');
    let spdS=document.getElementById('spd_s'),spdN=document.getElementById('spd_n'),altS=document.getElementById('alt_s'),altN=document.getElementById('alt_n');
    let pitchStepS=document.getElementById('pitchStep'),pitchSpacingS=document.getElementById('pitchSpacing'),pitchSpacingN=document.getElementById('pitchSpacingN');
    let bgC=document.getElementById('bg');
    let mainSpdS=document.getElementById('mainSpd'),mainAltS=document.getElementById('mainAlt');
    let mainColorC=document.getElementById('mainColor');
    let hudFrameRateS=document.getElementById('hudFrameRate');
    let fpvEnableC=document.getElementById('fpvEnable'),fpvScaleS=document.getElementById('fpvScale'),fpvScaleN=document.getElementById('fpvScaleN');
    let fpvDistanceS=document.getElementById('fpvDistance'),fpvDistanceN=document.getElementById('fpvDistanceN');
    let fpvAutoHeightS=document.getElementById('fpvAutoHeight'),fpvAutoHeightN=document.getElementById('fpvAutoHeightN');

    xS.value=H.x;xN.value=H.x;yS.value=H.y;yN.value=H.y;sS.value=H.s;sN.value=H.s;oS.value=H.o;oN.value=H.o;
    spdS.value=H.spdScroll;spdN.value=H.spdScroll;
    altS.value=H.altScroll*10;altN.value=H.altScroll*10;
    pitchStepS.value=H.pitchStep;pitchSpacingS.value=H.pitchSpacing;pitchSpacingN.value=H.pitchSpacing;
    bgC.checked=H.bg;preS.value=H.pre;
    mainSpdS.value=H.mainSpd;mainAltS.value=H.mainAlt;
    mainColorC.value=H.mainColor;
    hudFrameRateS.value=H.hudFrameRate;
    fpvEnableC.checked=H.fpvEnabled;fpvScaleS.value=H.fpvScale;fpvScaleN.value=H.fpvScale;
    fpvDistanceS.value=H.fpvDistance;fpvDistanceN.value=H.fpvDistance;
    fpvAutoHeightS.value=H.fpvAutoHeight;fpvAutoHeightN.value=H.fpvAutoHeight;

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
        H.hudFrameRate=parseInt(hudFrameRateS.value)||30;
        H.fpvEnabled=fpvEnableC.checked;
        H.fpvScale=parseFloat(fpvScaleS.value)||0.5;
        H.fpvDistance=parseInt(fpvDistanceS.value)||15;
        H.fpvAutoHeight=parseInt(fpvAutoHeightS.value)||5000;
        xN.value=H.x;yN.value=H.y;sN.value=H.s;oN.value=H.o;spdN.value=H.spdScroll;altN.value=H.altScroll*10;
        pitchSpacingN.value=H.pitchSpacing;
        fpvScaleN.value=H.fpvScale;fpvDistanceN.value=H.fpvDistance;fpvAutoHeightN.value=H.fpvAutoHeight;
        if(fpvPoint&&fpvPoint.billboard){
            fpvPoint.billboard.scale=H.fpvScale;
            fpvPoint.billboard.color=Cesium.Color.fromCssColorString(H.mainColor);
        }
        H.pre='custom';
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
    mainSpdS.onchange=upd;mainAltS.onchange=upd;
    mainColorC.oninput=upd;
    hudFrameRateS.onchange=upd;
    fpvEnableC.onchange=upd;
    fpvScaleS.oninput=()=>{fpvScaleN.value=fpvScaleS.value;upd()};
    fpvScaleN.oninput=()=>{fpvScaleS.value=fpvScaleN.value;upd()};
    fpvDistanceS.oninput=()=>{fpvDistanceN.value=fpvDistanceS.value;upd()};
    fpvDistanceN.oninput=()=>{fpvDistanceS.value=fpvDistanceN.value;upd()};
    fpvAutoHeightS.oninput=()=>{fpvAutoHeightN.value=fpvAutoHeightS.value;upd()};
    fpvAutoHeightN.oninput=()=>{fpvAutoHeightS.value=fpvAutoHeightN.value;upd()};

    preS.onchange=(e)=>{
        let p=e.target.value;
        if(P[p]){
            let preset=P[p];
            let nx=preset.getX?.(innerWidth)||preset.x;
            xS.value=nx;xN.value=nx;yS.value=preset.y;yN.value=preset.y;sS.value=preset.s;sN.value=preset.s;
            oS.value=preset.o;oN.value=preset.o;spdS.value=preset.spdScroll;spdN.value=preset.spdScroll;
            altS.value=preset.altScroll*10;altN.value=preset.altScroll*10;
            pitchStepS.value=preset.pitchStep||5;pitchSpacingS.value=preset.pitchSpacing||3;pitchSpacingN.value=preset.pitchSpacing||3;
            bgC.checked=preset.bg;mainSpdS.value=preset.mainSpd||'TAS';mainAltS.value=preset.mainAlt||'MSL';
            mainColorC.value=preset.mainColor||'#14be00';hudFrameRateS.value=preset.hudFrameRate||30;
            fpvEnableC.checked=preset.fpvEnabled!==undefined?preset.fpvEnabled:true;
            fpvScaleS.value=preset.fpvScale||0.5;fpvScaleN.value=preset.fpvScale||0.5;
            fpvDistanceS.value=preset.fpvDistance||15;fpvDistanceN.value=preset.fpvDistance||15;
            fpvAutoHeightS.value=preset.fpvAutoHeight||5000;fpvAutoHeightN.value=preset.fpvAutoHeight||5000;
            upd(); H.pre=p;
        }
    };

    document.getElementById('reset').onclick=()=>{
        let def=P.center_no_ads;
        let nx=def.getX?.(innerWidth)||def.x;
        xS.value=nx;xN.value=nx;yS.value=def.y;yN.value=def.y;sS.value=def.s;sN.value=def.s;
        oS.value=def.o;oN.value=def.o;spdS.value=def.spdScroll;spdN.value=def.spdScroll;
        altS.value=def.altScroll*10;altN.value=def.altScroll*10;
        pitchStepS.value=5;pitchSpacingS.value=3;pitchSpacingN.value=3;
        bgC.checked=def.bg;mainSpdS.value='TAS';mainAltS.value='MSL';
        mainColorC.value='#14be00';hudFrameRateS.value=30;
        fpvEnableC.checked=true;fpvScaleS.value=0.5;fpvScaleN.value=0.5;
        fpvDistanceS.value=15;fpvDistanceN.value=15;
        fpvAutoHeightS.value=5000;fpvAutoHeightN.value=5000;
        upd(); preS.value='center_no_ads'; H.pre='center_no_ads';
    };

    document.getElementById('save').onclick=()=>{
        save();
        panel.remove();
        panel=null;
    };
}

// ==================== 初始化 ====================
let lastDraw=0;
function anim(now){
    let interval=Math.floor(1000/H.hudFrameRate);
    if(now-lastDraw>=interval){
        draw();
        lastDraw=now;
    }
    requestAnimationFrame(anim);
}

function init(){
    load();
    cv=document.createElement('canvas');cv.id='geo-hud-canvas';
    cv.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
    cv.width=innerWidth;cv.height=innerHeight;
    ctx=cv.getContext('2d');document.body.appendChild(cv);
    
    // 启动HUD动画
    requestAnimationFrame(anim);
    
    // 延迟启动FPV，等待Cesium完全就绪
    setTimeout(()=>{initFPV(); updateFPV();},
