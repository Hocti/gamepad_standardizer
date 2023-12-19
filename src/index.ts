
enum directSource{
    dpad='dpad',
    leftAnalog='leftAnalog',
    rightAnalog='rightAnalog',
}
enum dpad{
    up='up',
    down='down',
    left='left',
    right='right'
}

export type gamepadInfo={
    name:string;
    buttonNames:(string|null)[];
    analogNames:string[];
    standard:boolean;
    defaultSwapAB?:boolean;
    guid?:string;
    vendor?:string;
    product?:string;
    hatDpad?:Record<dpad,number>;
    analogPlusNames?:string[];
    analogMinusNames?:string[];
    keyMapping?:(number|null)[];
}

type xy={x:number,y:number}
type dpadPress=Record<dpad,boolean>
export type directionWrap=dpadPress & xy & {
    numpad:number,//1~9 int
    radian: number,//0~2pi
    degree: number,//0~359 int
    distance: number,//0~1
    type:'analog'|'dpad'
}

export type gamePadProfile={
    vendorName?:string,
    vendor:string,
    productName?:string,
    product?:string,
    buttonNames:(string | null)[],
    defaultSwapAB?:boolean
}

//from SDL DB================================================================

const OS:string=(function detectOS() {
    const userAgent = window.navigator.userAgent;
    const platform = window.navigator.platform;
    const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
    const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
    const iosPlatforms = ['iPhone', 'iPad', 'iPod'];

    if (macosPlatforms.indexOf(platform) !== -1) {
        return 'Mac OS X';
    } else if (iosPlatforms.indexOf(platform) !== -1) {
        return 'iOS';
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
        return 'Windows';
    } else if (/Android/.test(userAgent)) {
        return 'Android';
    } else if (/Linux/.test(platform)) {
        return 'Linux';
    }

    return 'unknown';
})()

let gamepadDB:gamepadInfo[]=[];
let gamePadDBLink=`https://raw.githubusercontent.com/gabomdq/SDL_GameControllerDB/master/gamecontrollerdb.txt`;

export function SDLDB_setLink(link:string):void{
    gamePadDBLink=link;
}

export async function SDLDB_fetch(_dbtxtlink:string=gamePadDBLink){
    await fetch(_dbtxtlink).then((res)=>res.text()).then(SDLDB_processText);
}

const lineReg=/^([^a-z0-9]{0,1})([a-z]{1})([\d.]{1,3})([^a-z0-9]{0,1})$/
export function SDLDB_processText(text:string):void{
    let lines=text.split("\n");

    //let bKeySet:Set<string>=new Set();

    for(let line of lines){
        if(line.startsWith("#"))continue;
        let arr=line.split(",");

        const guid=arr[0];
        if(guid.length!==32)continue;
        if(OS!=='' && line.indexOf('platform:'+OS)<0)continue;
        const name=arr[1];
        const vendor=guid.substring(10,12)+guid.substring(8,10)
        const product=guid.substring(18,20)+guid.substring(16,18)

        const buttonNames:string[]=[];
        const analogNames:string[]=[];
        const analogPlusNames:string[]=[];
        const analogMinusNames:string[]=[];
        const keyMapping:number[]=[];
        let hatDpad:Record<dpad,number> | undefined;


        for(let i=2,t=arr.length-1;i<t;i++){
            const [key,value]=arr[i].split(":");
            if(key==='platform')continue;

            const valArr=value.match(lineReg)
            if(!valArr || valArr.length<5){
                continue;
            }
            const [,start,type,,end]=valArr;
            //  +/-,a/b/h,0~n/0.2~0.8,~
            const num=parseInt(valArr[3]);


            if(type==='b'){//button
                buttonNames[num]=key;
                const defautIndex=UNSTANDARD_BUTTON_NAME.indexOf(key);
                if(defautIndex!==-1 && defautIndex!==num){
                    keyMapping[num]=defautIndex;
                }
                //bKeySet.add(key);
            }else if(type==='a'){//analog
                //bKeySet.add(key);
                if(start==''){
                    analogNames[num]=key;
                }else if(start!==''){
                    if(start=='+'){
                        analogPlusNames[num]=key;
                        //bKeySet.add(key);
                    }else{
                        analogMinusNames[num]=key;
                        //bKeySet.add(key);
                    }
                }
            }else if(type==='h'){//SDL hat to Dpad
                if(!hatDpad){
                    hatDpad={up:0,down:0,left:0,right:0};
                }
                const [hat,hatval]=valArr[3].split('.')
                if(hatval){
                    if(key.substring(2)==='dp'){
                        hatDpad[key.substring(2) as dpad]=parseInt(hatval);
                    }else{
                        //*
                    }
                }
            }
        }
        
        gamepadDB.push({
            name,
            buttonNames,
            analogNames,
            standard:false,
            defaultSwapAB:getSwapAB(vendor,product),
            guid,
            vendor,
            product,
            analogPlusNames,
            analogMinusNames,
            keyMapping,
            hatDpad
        })
    }
    
    //console.log(bKeySet)
}

//button alt name profile================================================================

const UNSTANDARD_BUTTON_NAME=['a','b','x','y','leftshoulder','rightshoulder','lefttrigger','righttrigger','back','start','leftstick','rightstick','dpup','dpdown','dpleft','dpright','guide'];

const XINPUT_BUTTON_NAME=['A','B','X','Y','LB','RB','LT','RT','back','start','left Stick','right Stick','🔼','🔽','◀️','▶️','home']

const btnNameProfile:gamePadProfile[]=[
    {
        vendorName:'Sony',
        vendor:'054c',
        buttonNames:['🗙','⭕','🔳','🛆','L1','R1','L2','R2','Share','Options','L3','R3','🔼','🔽','◀️','▶️','PS','Touch']
    },
    {
        vendorName:'Nintendo',
        vendor:'057e',
        defaultSwapAB:true,
        buttonNames:['B','A','Y','X','L','R','ZL','ZR','-','+','left Stick','right Stick','🔼','🔽','◀️','▶️','home','share']
    }]

export function addbtnNameProfile(profile:gamePadProfile){
    btnNameProfile.push(profile);
}

function getSwapAB(vendor:string | undefined,product:string | undefined):boolean{
    if(vendor==='045e' && product==='02ea'){//Xbox One Controller
        return true;
    }
    for(let profile of btnNameProfile){
        if(profile.vendor===vendor && profile.product===product){
            return profile.defaultSwapAB??false;
        }
    }
    return false;
}

//================================================================


function parseGamepadId(input: string): { name: string;vendor: string; product: string;  } {//type: string
    // Regular expressions to extract the relevant parts
    const nameRegex = /^(.*?) \(/;
    const vendorRegex = /Vendor: ([\w]+)/;
    const productRegex = /Product: ([\w]+)/;
    //const typeRegex = /\((.*?)(Vendor:(.*?)?)?\)/;

    const ffRegex = /^([\w]{4})-([\w]{4})-(.*?)$/;
    const ffMatch=input.match(ffRegex)
    if(ffMatch?.length==4){
        return {
            name: ffMatch![3],
            vendor: ffMatch![1],
            product: ffMatch![2],
        };
    }

    // Extracting the parts using the regular expressions
    const nameMatch = input.match(nameRegex);
    const vendorMatch = input.match(vendorRegex);
    const productMatch = input.match(productRegex);
    //const typeMatch = input.match(typeRegex);

    //"8BitDo Zero 2 gamepad (Vendor: 2dc8 Product: 9018)"
    //"2dc8-9018-8BitDo Zero 2 gamepad"


    // Return the parsed object, handling cases where a match might not be found
    return {
        name: nameMatch ? nameMatch[1] : '',
        vendor: vendorMatch ? vendorMatch[1] : '',
        product: productMatch ? productMatch[1] : '',
        //type: typeMatch ? typeMatch[1] : ''
    };
}  

export async function getGamepadInfo(gamepad:Gamepad):Promise<gamepadInfo>{
    const baseInfo:gamepadInfo={...parseGamepadId(gamepad.id),
        standard:gamepad.mapping==='standard',
        buttonNames:UNSTANDARD_BUTTON_NAME,
        analogNames:['leftx','lefty','rightx','righty']
    };
    
    //unstandard
    if(gamepad.mapping!=='standard'){

        if(baseInfo.vendor!=='' && baseInfo.product!==''){
            if(gamepadDB.length===0){
                await SDLDB_fetch();
            }
            for(let info of gamepadDB){
                if(info.vendor===baseInfo.vendor && info.product===baseInfo.product){
                    //unstandard and DB data
                    return info;
                }
            }
        }

        //unstandard and no DB data
        const buttonNames:string[]=[];
        const analogNames:string[]=[];
        for(let i=0;i<gamepad.buttons.length;i++){
            buttonNames[i]='button'+(1+i);
        }
        for(let i=0;i<gamepad.axes.length;i++){
            analogNames[i]='axes'+(1+i);
        }
        return {...baseInfo,analogNames,buttonNames,defaultSwapAB:getSwapAB(baseInfo.vendor,baseInfo.product)};
    }

    let result:gamepadInfo={...baseInfo};
    
    if(result.buttonNames.length<gamepad.buttons.length){
        for(let i=result.buttonNames.length;i<gamepad.buttons.length;i++){
            result.buttonNames[i]='button'+(i);
        }
    }

    return result;
}


//Dpad and Analog================================================================

const numpad2Degree=[0,225,180,135,270,0,90,315,0,45];
const lrxyReg=/^([+|-])?(left|right)(x|y|trigger)$/
const toDpadThreshold:number=Math.tan(Math.PI/8);

//hardcode..
const HDpadMapping:Record<string,number>={
    '9':    0b0000,
    '-7':   0b0001,
    '-3':   0b0010,
    '-5':   0b0011,
    '1':    0b0100,
    '-1':   0b0110,
    '5':    0b1000,
    '7':    0b1001,
    '3':    0b1100,
}

function getAnalogDirection(d:xy,threshold:number): directionWrap {
    const {x,y}=d;
    const distanceRaw = Math.sqrt(x * x + y * y);

    let radian = distanceRaw<threshold?0:Math.atan2(y, x);
    if(radian<0)radian=Math.PI*2+radian;
    radian=((radian+Math.PI/2))%(Math.PI*2);

    const distance=Math.min(Math.max(0,(distanceRaw-threshold)/(1-threshold)),1);
    const degree=Math.round(radian/Math.PI*180);
    const up=y<-toDpadThreshold;
    const down=y>toDpadThreshold;
    const left=x<-toDpadThreshold;
    const right=x>toDpadThreshold;
    const numpad = dpadPress2Numpad({up,down,left,right})
    return { radian, degree,distance ,numpad,up,down,left,right,x,y,type:'analog'};
}
function getDpadDirection(d:dpadPress): directionWrap {
    const numpad=dpadPress2Numpad(d)
    return    {
        ...d,
        x:d.left?-1:(d.right?1:0),
        y:d.up?-1:(d.down?1:0),
        numpad,
        distance:numpad===5?0:1,
        degree:numpad2Degree[numpad],
        radian:numpad2Degree[numpad]/180*Math.PI,
        type:'dpad'
    }
}
function dpadPress2Numpad(d:dpadPress): number {
    return 5+(d.up?3:(d.down?-3:0))+(d.left?-1:(d.right?1:0))
}
function makeDirection(threshold:number,dpad?:dpadPress,leftA?:xy,rightA?:xy):Record<directSource,directionWrap|null>{
    return {
        leftAnalog:leftA?getAnalogDirection(leftA,threshold):null,
        rightAnalog:rightA?getAnalogDirection(rightA,threshold):null,
        dpad:dpad?getDpadDirection(dpad):null
    }
}

export function getDirectionAvailable(gamepad:Gamepad,info:gamepadInfo):Record<directSource,boolean> {
    
    //standard
    if(gamepad.mapping=='standard'){
        return {
            dpad:           gamepad.buttons.length>=15,
            leftAnalog:     gamepad.axes.length>=2,
            rightAnalog:    gamepad.axes.length>=4
        }
    }

    //non standard
    let haveTypeSet=new Set<string>();
    if(info.hatDpad)haveTypeSet.add('dpad');
    //button
    for(let i=0;i<info.buttonNames.length;i++){
        if(info.buttonNames[i]){
            if(info.buttonNames[i]!.substring(0,2)==='dp'){
                haveTypeSet.add('dpad');
            }else{
                const valArr=info.buttonNames[i]!.match(lrxyReg)
                if(valArr){
                    const [,dir,lr,xy]=valArr;
                    haveTypeSet.add(lr);
                }
            }
        }
    }
    //analog
    for(let i=0;i<gamepad.axes.length;i++){
        let analogType=0;
        let name='';
        if(info.analogNames[i]!=null){
            analogType=0;
            name=info.analogNames[i];
        }else if(info.analogPlusNames && info.analogPlusNames[i]){
            analogType=1
            name=info.analogPlusNames[i];
        }else if(info.analogMinusNames && info.analogMinusNames[i]){
            analogType=-1
            name=info.analogMinusNames[i];
        }else{
            continue;
        }
        if(name.substring(0,2)==='dp'){
            haveTypeSet.add('dpad');
        }else{
            const valArr=info.buttonNames[i]!.match(lrxyReg)
            if(valArr){
                const [dir,lr,xy]=valArr;
                haveTypeSet.add(lr);
            }
        }
    }

    //result
    return {
        dpad:           haveTypeSet.has('dpad'),
        leftAnalog:     haveTypeSet.has('left'),
        rightAnalog:    haveTypeSet.has('right')
    };
}

export function getDirection(gamepad:Gamepad,info:gamepadInfo,threshold:number=0.1):Record<directSource,directionWrap|null>{
    
    //standard
    if(gamepad.mapping=='standard'){
        return makeDirection(
            threshold,
            gamepad.buttons.length>=16?{
                up: gamepad.buttons[12].pressed,
                down:   gamepad.buttons[13].pressed,
                left:   gamepad.buttons[14].pressed,
                right:  gamepad.buttons[15].pressed
            }:undefined,
            gamepad.axes.length>=2?{
                x:gamepad.axes[0],
                y:gamepad.axes[1]
            }:undefined,
            gamepad.axes.length>=4?{
                x:gamepad.axes[2],
                y:gamepad.axes[3]
            }:undefined
        );
    }

    //non standard
    let dpad:dpadPress={
        up:false,
        down:false,
        left:false,
        right:false
    }
    let analogRaw:{left:xy,right:xy}={
        left:{  x:0,y:0},
        right:{  x:0,y:0}
    }
    let haveTypeSet=new Set<string>();
    //button
    for(let i=0;i<gamepad.buttons.length;i++){
        if(info.buttonNames[i]){
            if(info.buttonNames[i]!.substring(0,2)==='dp'){
                haveTypeSet.add('dpad');
                if(gamepad.buttons[i].pressed){
                    dpad[info.buttonNames[i]!.substring(2) as ('up'|'down'|'left'|'right')]=true;
                }
            }else{
                const valArr=info.buttonNames[i]!.match(lrxyReg)
                if(valArr){
                    const [,dir,lr,xy]=valArr;
                    haveTypeSet.add(lr);
                    if(gamepad.buttons[i].pressed){
                        analogRaw[lr as ('left'|'right')][xy as ('x'|'y')]=(dir==='-'?-1:(dir==='+'?1:0));
                    }else{
                        const v=gamepad.buttons[i].value;
                        analogRaw[lr as ('left'|'right')][xy as ('x'|'y')]=(dir==='-'?-v:v);
                    }
                }
            }
        }
    }
    //analog
    for(let i=0;i<gamepad.axes.length;i++){
        let analogType=0;
        let name='';
        if(info.analogNames[i]!=null){
            analogType=0;
            name=info.analogNames[i];
        }else if(info.analogPlusNames && info.analogPlusNames[i] && gamepad.axes[i]>0){
            analogType=1
            name=info.analogPlusNames[i];
        }else if(info.analogMinusNames && info.analogMinusNames[i] && gamepad.axes[i]<0){
            analogType=-1
            name=info.analogMinusNames[i];
        }else{
            if(info.hatDpad){
                haveTypeSet.add('dpad');
                const HNum=Math.round(gamepad.axes[i]*7);
                if( gamepad.axes[i]!=0 && (Math.abs(gamepad.axes[i]*7-HNum)<0.000001) && HDpadMapping[HNum.toString()]){
                    const v=HDpadMapping[HNum.toString()];
                    for(let key in dpad){
                        dpad[key as dpad]=(v & info.hatDpad[key as dpad]) >0
                    }
                }
            }
            continue;
        }
        if(name.substring(0,2)==='dp'){
            haveTypeSet.add('dpad');
            if(Math.abs(gamepad.axes[i])>toDpadThreshold && (analogType===0 || (gamepad.axes[i]>0 && analogType===1) || (gamepad.axes[i]<0 && analogType===-1))){
                dpad[name.substring(2) as ('up'|'down'|'left'|'right')]=true;
            }
        }else{
            const valArr=name.match(lrxyReg)
            if(valArr){
                const [,dir,lr,atype]=valArr;
                haveTypeSet.add(lr);
                //console.log(name,dir,lr,atype)
                //if(Math.abs(gamepad.axes[i])<threshold )continue;
                if(atype =='x'||atype =='y'){
                    analogRaw[lr as ('left'|'right')][atype as ('x'|'y')]=gamepad.axes[i];
                    //*(dir==='-'?-1:(dir==='+'?1:0))
                }else if(atype =='trigger'){
                    //*
                }
            }
        }
    }
    //result
    return makeDirection(threshold,
        haveTypeSet.has('dpad')?dpad:undefined,
        haveTypeSet.has('left')?analogRaw.left:undefined,
        haveTypeSet.has('right')?analogRaw.right:undefined
    );
}

export function getExtraAnalog(gamepad:Gamepad,info:gamepadInfo):Record<string,number>{
    const result:Record<string,number>={};
    for(let i=0;i<gamepad.axes.length;i++){
        let analogType=0;
        let name='';
        if(info.analogNames[i]!=null){
            analogType=0;
            name=info.analogNames[i];
        }else if(info.analogPlusNames && info.analogPlusNames[i] && gamepad.axes[i]>0){
            analogType=1
            name=info.analogPlusNames[i];
        }else if(info.analogMinusNames && info.analogMinusNames[i] && gamepad.axes[i]<0){
            analogType=-1
            name=info.analogMinusNames[i];
        }else{
            continue;
        }
        if(name.substring(0,2)==='dp'){
            continue;
        }else{
            const valArr=name.match(lrxyReg)
            if(valArr){
                const [,dir,lr,atype]=valArr;
                if(atype =='x'||atype =='y'){
                    continue;
                }
            }
            result[name]=gamepad.axes[i]
        }
    }
    return result;
}

//Button================================================================

/*
export function getRawButtonPress(gamepad:Gamepad):boolean[]{
    const result:boolean[]=[];
    for(let i=0;i<gamepad.buttons.length;i++){
        result[i]=gamepad.buttons[i].pressed;
    }
    return result;
}
*/

export function getButtonPress(gamepad:Gamepad,info:gamepadInfo,skipDpad:boolean=false):(boolean|null)[]{
    const result:(boolean|null)[]=[];
    for(let i=0;i<gamepad.buttons.length;i++){
        if(gamepad.mapping==='standard'){
            if(!info.buttonNames[i]){
                result[i]=null;
                continue;
            }
            if(skipDpad && i>=12 && i<=15){
                result[i]=null;
                continue;
            }
            result[i]=gamepad.buttons[i].pressed;

        }else{
            const converToStandKey:number=info.keyMapping?.[i]??i;
            if(!info.buttonNames[i]){
                // special case for some SDL mapping not counting trigger as button but analog
                if(info.buttonNames[5]=='rightshoulder' && info.buttonNames[8]=='back'){
                    if(
                        (i==6 && info.analogNames.indexOf('lefttrigger')>=0)
                        ||
                        (i==7 && info.analogNames.indexOf('righttrigger')>=0)
                    ){
                        result[i]=gamepad.buttons[i].pressed;
                        continue;
                    }
                }
                result[converToStandKey]=null;
                continue;
            }
            if(skipDpad){
                if(info.buttonNames[i]!.substring(0,2)==='dp'){
                    result[converToStandKey]=null;
                    continue;
                }else{
                    const valArr=info.buttonNames[i]!.match(lrxyReg)
                    if(valArr){    
                        result[converToStandKey]=null;
                        continue;
                    }
                }
            }

            result[converToStandKey]=gamepad.buttons[i].pressed;
        }
    }
    return result;
}

export function getButtonValue(gamepad:Gamepad,info:gamepadInfo,skipDpad:boolean=false):(number|null)[]{
    const result:(number|null)[]=[];
    for(let i=0;i<gamepad.buttons.length;i++){
        if(gamepad.mapping==='standard'){
            if(!info.buttonNames[i]){
                result[i]=null;
                continue;
            }
            if(skipDpad && i>=12 && i<=15){
                result[i]=null;
                continue;
            }
            result[i]=gamepad.buttons[i].value;

        }else{
            const converToStandKey:number=info.keyMapping?.[i]??i;
            if(!info.buttonNames[i]){
                // special case for some SDL mapping not counting trigger as button but analog
                if(info.buttonNames[5]=='rightshoulder' && info.buttonNames[8]=='back'){
                    if(
                        (i==6 && info.analogNames.indexOf('lefttrigger')>=0)
                        ||
                        (i==7 && info.analogNames.indexOf('righttrigger')>=0)
                    ){
                        result[i]=gamepad.buttons[i].value;
                        continue;
                    }
                }
                result[converToStandKey]=null;
                continue;
            }
            if(skipDpad){
                if(info.buttonNames[i]!.substring(0,2)==='dp'){
                    result[converToStandKey]=null;
                    continue;
                }else{
                    const valArr=info.buttonNames[i]!.match(lrxyReg)
                    if(valArr){    
                        result[converToStandKey]=null;
                        continue;
                    }
                }
            }

            result[converToStandKey]=gamepad.buttons[i].value;
        }
    }
    return result;
}

export function getButtonName(info:gamepadInfo,rename:boolean=false):(string|null)[]{
    const result:(string|null)[]=[];

    //get original name
    for(let i=0;i<info.buttonNames.length;i++){
        if(info.buttonNames[i]){
            const converToStandKey:number=info.keyMapping?.[i]??i;
            result[converToStandKey]=info.buttonNames[i];

        // special case for some SDL mapping not counting trigger as button but analog
        }else if(info.buttonNames[5]=='rightshoulder' && info.buttonNames[8]=='back'){
            if(i==6 && info.analogNames.indexOf('lefttrigger')>=0){
                result[6]='lefttrigger';
            }
            if(i==7 && info.analogNames.indexOf('righttrigger')>=0){
                result[7]='righttrigger';
            }
        }
    }

    if(rename){
        //rename to vendor default
        let newNames:(string | null)[] | undefined;
        if(!newNames && info.standard){
            newNames=XINPUT_BUTTON_NAME;
            console.log('standard',info.name,result)
        }
        for(let profile of btnNameProfile){
            console.log('rename',profile.vendor,info.vendor,profile.product,info.product,profile.vendor===info.vendor && profile.product===info.product)
            if(profile.vendor===info.vendor && (!profile.product || profile.product===info.product)){
                newNames=profile.buttonNames;
                break;
            }
        }

        if(newNames){
            for(let i=0;i<result.length;i++){
                if(result[i] && newNames[i] && (i<12 || i>15)){
                    result[i]=newNames[i]
                }
            }
        }
    }

    return result;
}