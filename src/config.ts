

export const DP_BUTTON_NAME=['dpup','dpdown','dpleft','dpright'];

export const SYSTEM_BUTTON_NAME=['a','b','x','y','leftshoulder','rightshoulder','lefttrigger','righttrigger','back','start','leftstick','rightstick','dpup','dpdown','dpleft','dpright','guide'];

//type hatDpadNum=(-1|-3|7|5);

export const HDpadMapping:Record<string,number>={
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
export const oppositeDpad:Record<string,string>={
    '-7':   '1',
    '1':    '-7',
    '5':    '-3',
    '-3':   '5',
    '7':   '-1',
    '-1':    '7',
    '-5':    '-',
    '3':   '-5',
}