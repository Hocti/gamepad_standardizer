export enum dpad{
    up='up',
    down='down',
    left='left',
    right='right'
}

export type xy={x:number,y:number}
export type dpadPress=Record<dpad,boolean>

export type directionWrap=dpadPress & xy & {
    numpad:number,//1~9 int
    radian: number,//0~2pi
    degree: number,//0~359 int
    distance: number,//0~1
    type:'analog'|'dpad'
}




const numpad2Degree=[0,225,180,135,270,0,90,315,0,45];
const toDpadThreshold:number=Math.tan(Math.PI/8);

export function getAnalogDirection(d:xy,threshold:number): directionWrap {
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

export function getDpadDirection(d:dpadPress): directionWrap {
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