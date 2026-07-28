        import * as gamepad_standardizer from "gamepad_standardizer";

        const output = document.getElementById('output');

        // Inject the controller glyph webfonts (gamepad_fonts) once.
        gamepad_standardizer.installPadFonts();

        // This demo forces the Xbox 360 look (coloured chips) instead of the
        // default Xbox One look (grey chips) — just to show the font swap.
        const GLYPH_OPTS = { xboxStyle: '360' };

        // Button *names* are one shared set on every vendor (the SDL standard names); only
        // the glyph artwork changes. So a controller profile is now a single font choice
        // instead of a full rename table — here, an 8BitDo SF30 drawn as a Nintendo pad.
        // button order reference: https://www.w3.org/TR/gamepad/#remapping
        gamepad_standardizer.addPadFontProfile({
            product: "ab21",
            vendor: "2dc8",
            defaultSwapAB: true,
            system: 'switch'
        })

        //gamepad_standardizer.SDLDB_procesExtraText(`platform:Android,browser:Chrome,name:8BitDo Zero 2,vendor:2dc8,product:9018,defaultSwapAB:1,font:switch,a:b0,b:b1,back:b9,dpdown:h0.4,dpleft:h0.8,dpright:h0.2,dpup:h0.1,leftshoulder:b4,leftx:a0,lefty:a1,rightshoulder:b20,start:b10,x:b19,y:b2`)

        //getDirection's three sources, each drawn with its own common-font sheet
        const DIRECTION_SOURCE: Record<string, 'dpad' | 'lstick' | 'rstick'> = {
            dpad: 'dpad',
            leftAnalog: 'lstick',
            rightAnalog: 'rstick',
        };

        const infos = [];
        const btnNames = [];
        const btnGlyphs = [];

        //set gamecontrollerdb.txt ,default is gitbub's version
        gamepad_standardizer.SDLDB_setLink('./gamecontrollerdb.txt')

        //Per-device overrides for pads the *browser* maps wrongly, written against the raw
        //indices printed in the "RAW Button Input" table below. The package ships one .txt as a
        //default (src/db/local_override.txt); add your own on top — later files win. Like the SDL
        //DB, nothing is fetched until a non-standard pad connects.
        //gamepad_standardizer.addLocalOverrideUrl('./my-pads.txt')

        window.addEventListener('gamepadconnected', function (e) {
            gamepad_standardizer.getGamepadInfo(e.gamepad).then(function (gamepad_info) {

                //prepare the gamepad info and button name
                infos[e.gamepad.index] = gamepad_info;

                //the standard button names — same set whatever the vendor
                btnNames[e.gamepad.index] = gamepad_standardizer.getButtonName(gamepad_info);

                //one glyph (character + font-family) per standard button index
                btnGlyphs[e.gamepad.index] = gamepad_standardizer.getButtonGlyphs(gamepad_info, GLYPH_OPTS);

                console.log(gamepad_info, btnNames[e.gamepad.index])
                console.log(gamepad_standardizer.getDirectionAvailable(gamepad_info))
            });
        });

        let lastH = '';
        function frameUpdate() {
            const gamepads = navigator.getGamepads();
            let gpCount = 0;
            let outputHtml = ``
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i] && infos[i]) {
                    gpCount++;

                    //get the browser raw button press and value
                    let table1 = `<tr><th colspan=2>RAW Button Input</th><tr>
                <tr><th>Index</th><th>pressed</th><th>Value</th><tr>`
                    for (let j in gamepads[i].buttons) {
                        table1 += `<tr><td>${j}</td><td>${gamepads[i].buttons[j].pressed}</td><td>${gamepads[i].buttons[j].value}</td></tr>`
                    }

                    //get the mapped button press and value, with name & new name we set before
                    const presses = gamepad_standardizer.getButtonPress(gamepads[i], infos[i])
                    const values = gamepad_standardizer.getButtonValue(gamepads[i], infos[i])
                    let table2 = `<tr><th colspan=2>Mapped Button Input</th><tr>
                <tr><th>Index</th><th>Name</th><th>Glyph</th><th>Pressed</th><th>Value</th><tr>`
                    for (let j = 0; j < btnNames[i].length; j++) {
                        if (!btnNames[i][j]) {
                            table2 += `<tr><td>${j}</td><td colspan=4>unuse</td></tr>`
                        } else {
                            const g = btnGlyphs[i]?.[j];
                            const glyphCell = g && g.char
                                ? `<span class="pad-glyph" style="font-family:'${g.fontFamily}'">${g.char}</span>`
                                : '';

                            table2 += `<tr>
                        <td>${j}</td>
                        <td>${btnNames[i][j]}</td>
                        <td>${glyphCell}</td>
                        <td>${presses[j]}</td>
                        <td>${values[j]}</td>
                    </tr>`
                        }
                    }

                    //get the browser raw axes value
                    let table3 = `<tr><th colspan=2>RAW axes</th><tr>
                <tr><th>index</th><th>Value</th><tr>`
                    for (let j in gamepads[i].axes) {
                        table3 += `<tr><td>${j}</td><td>${gamepads[i].axes[j]}</td></tr>`
                    }

                    //get the mapped analog and dpad value
                    const direction = gamepad_standardizer.getDirection(gamepads[i], infos[i])
                    let table4 = `<tr><th colspan=2>Mapped Direction</th><tr>
                <tr><th>type</th><th>Key</th><th>Value</th><tr>`
                    for (let j in direction) {
                        if (direction[j]) {
                            //the live direction as one glyph — d-pad and stick art is the
                            //same on every controller, so it comes from the common font
                            const g = gamepad_standardizer.directionGlyph(direction[j], DIRECTION_SOURCE[j])
                            table4 += `<tr><td>${j}</td><td colspan=2><span class="pad-glyph" style="font-family:'${g.fontFamily}'">${g.char}</span></td></tr>`
                            for (let k in direction[j])
                                table4 += `<tr><td>${j}</td><td>${k}</td><td>${direction[j][k]}</td></tr>`
                        }
                    }

                    //extra analogs if available
                    const analogs = gamepad_standardizer.getExtraAnalog(gamepads[i], infos[i])
                    let table5
                    if (Object.keys(analogs).length) {//}.keys().length>0){

                        table5 = `<table>
                    <tr><th colspan=2>Mapped Extra Analog</th><tr>
                        <tr><th>Key</th><th>Value</th><tr>`
                        for (let j in analogs) {
                            table5 += `<tr><td>${j}</td><td>${analogs[j]}</td></tr>`
                        }
                        table5 += `</table>`
                    }


                    outputHtml += `<h1>Gamepad ${i}: ${infos[i].name}</h1>
            <h3>${infos[i].originInfo.id}</h3>
            is standard: ${infos[i].standard}<br/>
            <div class='tables'>

                <table>${table1}</table>
                <table>${table3}</table>

                <table>${table2}</table>
                <table>${table4}</table>
                ${table5 ?? ''}
            </div><hr/>`
                }
            }

            outputHtml = outputHtml.replaceAll(`<td>true</td>`, `<td class='true'>true</td>`)
            if (gpCount === 0) {
                outputHtml = 'Press any key on gamepad'
            }
            if (lastH != outputHtml) {
                output.innerHTML = outputHtml;
                lastH = outputHtml;
            }

            requestAnimationFrame(frameUpdate)
        }
        window.requestAnimationFrame(frameUpdate)
