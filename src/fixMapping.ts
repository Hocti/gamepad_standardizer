
import {dpad} from './direction'
import {HDpadMapping,oppositeDpad,SYSTEM_BUTTON_NAME} from './config'


export function fixhatDpad(up_HNum:number,left_HNum:number):Record<dpad,number>{
    const up_HNum_str=up_HNum.toString();
    const left_HNum_str=up_HNum.toString();
    return {
        up:HDpadMapping[up_HNum_str],
        down:HDpadMapping[oppositeDpad[up_HNum_str]],
        left:HDpadMapping[left_HNum_str],
        right:HDpadMapping[oppositeDpad[left_HNum_str]],
    }
}

type fixAnalog_result={
    analogNames:string[],
    analogMinusNames?:string[],
    analogPlusNames?:string[],
    hatDpad?:Record<dpad,number>
}
export function fixAnalog(
    left?:{
        x:number,//axes_index
        y:number,//axes_index
    },
    right?:{
        x:number,//axes_index
        y:number,//axes_index
    },
    dpad_analog?:Record<dpad,{axes_index:number,Operation:'-'|'+'}>,
    dpad_hat?:{
        up_HNum:number,
        left_HNum:number
    }
):fixAnalog_result{
    const analogNames:string[]=[];

    if(left){
        analogNames[left.x]='leftx'
        analogNames[left.y]='lefty'
    }
    if(right){
        analogNames[right.x]='rightx'
        analogNames[right.y]='righty'
    }

    const result:fixAnalog_result={
        analogNames
    }

    if(dpad_analog){
        const analogMinusNames:string[]=[];
        const analogPlusNames:string[]=[];

        for(let direction in dpad_analog){
            const {axes_index,Operation}=dpad_analog![direction as dpad];
            if(Operation==='-'){
                analogMinusNames[axes_index]=`dp${direction}`;
            }else if(Operation==='+'){
                analogPlusNames[axes_index]=`dp${direction}`;
            }
        }

        if(analogMinusNames.length>0){
            result.analogMinusNames=analogMinusNames;
        }
        if(analogPlusNames.length>0){
            result.analogPlusNames=analogMinusNames;
        }
    }else if(dpad_hat){
        result.hatDpad=fixhatDpad(dpad_hat.up_HNum,dpad_hat.left_HNum);
    }
    return result;
}



type fixButtons_result={
    buttonNames:(string|null)[],
    keyMapping:(number|null)[]
}
export function fixButtons(data:Record<string,number>):fixButtons_result{
    const result:fixButtons_result={
        buttonNames:[],
        keyMapping:[]
    }
    for(let sysBtnName in data){
        const raw_btn_index=data[sysBtnName];
        const sys_index=SYSTEM_BUTTON_NAME.indexOf(sysBtnName);
        
        result.buttonNames[raw_btn_index]=sysBtnName;
        if(raw_btn_index!=sys_index){
            result.keyMapping[raw_btn_index]=sys_index;
        }
    }

    return result;
}