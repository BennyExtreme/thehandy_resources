// ==UserScript==
// @name         theHandy support for xhamster
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  theHandy support for xhamster forked from Nodude's theHandy support for PornHub
// @author       jabiim
// @match        https://*.xhamster.com/videos/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @require      http://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js
// @run-at       document-idle
// ==/UserScript==

//Inspired by Nodude
//Inspired by notSafeForDev

/*
Update 1.0
Forked from Nodude's theHandy support for PornHub
Added buffering support
Changed ui
Handy stops if you refres / close the window / tab
*/

class Hander {
    //Literally just taken from handyfeeling's player
    //But in a class
    //Also GM_xmlhttpRequest for that sweet cross-origin bypass
    constructor() {
        //this.URL_BASE = "http://192.168.137.1:3000/";
        this.URL_BASE = "https://www.handyfeeling.com/";
        this.URL_API_ENDPOINT = "api/v1/";
        this.urlAPI = "";

        this.timeSyncMessage = 0;
        this.timeSyncAggregatedOffset = 0;
        this.timeSyncAvrageOffset = 0;
        this.timeSyncInitialOffset = 0;
    }

    onReady(connectionkey, scriptUrl) {
		//URL_BASE can be local ip, but will browsers allow that?
		this.urlAPI = this.URL_BASE + this.URL_API_ENDPOINT + connectionkey;
		this.updateServerTime(); //Strat time sync with teh server

		//Prepare Handy by telling it where to download the script

        var datas = {
            url: scriptUrl,
            timeout: 30000,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPrepare?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPrepare: " + JSON.stringify(result) + "</li>";
                console.log(result);
                if (result.success == true) {
                    console.log("success");
                    document.getElementById("rdycrl").style.fill = "green";
                }
            }
        });
    }

    setOffset(ms) {
        console.log("offset",ms);

        var datas = {
            offset: ms,
            timeout: 30000,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncOffset?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncOffset: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }
    onPlay(videoTime) {
        videoTime = Math.round(videoTime*1000);
		console.log("playing",videoTime);

        var datas = {
            play: true,
            serverTime: this.getServerTime(),
            time: videoTime
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPlay: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }
    onPause() {
		console.log("pause");

        var datas = {
            play: false,
        }

        GM_xmlhttpRequest({
            method: "GET",
            url: this.urlAPI + "/syncPlay?" + new URLSearchParams(datas).toString(),
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                document.getElementById("state").innerHTML += "<li>Machine reply to syncPlay: " + JSON.stringify(result) + "</li>";
                console.log(result);
            }
        });
    }

    /*
	    sync time with server
    */

    getServerTime(){
        let serverTimeNow = Date.now() + this.timeSyncAvrageOffset + this.timeSyncInitialOffset;
        return Math.round(serverTimeNow);
    }

    updateServerTime() {
        let sendTime = Date.now();
        let url = this.urlAPI + "/getServerTime";
        // console.log("url:",url);

        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            context: {
                hand: this,
            },
            onload: function(response) {
                var result = JSON.parse(response.responseText);
                var context = response.context || this.context || context;
                var con = context.hand;
                // console.log(result);
                let now = Date.now();
                let receiveTime = now;
                let rtd = receiveTime - sendTime;
                let serverTime = result.serverTime;
                let estimatedServerTimeNow = serverTime + rtd /2;
                let offset = 0;
                if(con.timeSyncMessage == 0){
                    con.timeSyncInitialOffset = estimatedServerTimeNow - now;
                    console.log("timeSyncInitialOffset:",con.timeSyncInitialOffset);
                }else{
                    offset = estimatedServerTimeNow - receiveTime- con.timeSyncInitialOffset;
                    con.timeSyncAggregatedOffset += offset;
                    con.timeSyncAvrageOffset = con.timeSyncAggregatedOffset / con.timeSyncMessage;
                }
                console.log("Time sync reply nr " + con.timeSyncMessage + " (rtd, this offset, average offset):",rtd,offset,con.timeSyncAvrageOffset);
                con.timeSyncMessage++;
                if(con.timeSyncMessage < 30){
                    con.updateServerTime();
                }else{
                    //Time in sync
                    document.getElementById("state").innerHTML += "<li>Server time in sync. Average offset from client time: " + Math.round(con.timeSyncAvrageOffset) + "ms</li>";
                }
            }
        });
    }
}

(function() {
    'use strict';

    var scriptUrl = null;
    var handyKey = GM_getValue('handy_key','');
    var videoObj = null;
    var hand = new Hander();

    function getElementById(id) {
        return document.getElementById(id);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function shouldHand() {
        console.log(scriptUrl, handyKey);
        return scriptUrl != null && handyKey != null;
    }

    function onplay(e) {
        console.log("play");
        if (shouldHand()) {
            hand.onPlay(videoObj.currentTime);
        }

    }
    function onpause(e) {
        console.log("pause");
        if (shouldHand()) {
            hand.onPause();
        }
    }

    async function init() {
        window.addEventListener("beforeunload", function(e){
            if (shouldHand()) {
                hand.onPause();
            }
        }, false);
        //User config
        const selecting = document.createElement("div");
        selecting.style.padding = "20px";

        selecting.innerHTML += '<svg height="100" width="100" style="position:absolute; right:0px;"><circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" id="rdycrl" fill="red" /></svg>';

        const finputText = document.createElement("input");
        finputText.type = "file";
        finputText.placeholder = "Select a file";
        finputText.style.marginTop = '4px';
        finputText.style.marginBottom = '4px';
        finputText.style.display = 'block';

        const inputText = document.createElement("input");
        inputText.className = 'input-text';
        inputText.style.width = '200px';
        inputText.style.marginBottom = '4px';
        inputText.type = "text";
        inputText.value = handyKey;
        inputText.placeholder = "Enter connection key";
        inputText.style.display = 'block';

        const uploadButton = document.createElement("input");
        uploadButton.className = 'submit-comment xh-button large red'
        uploadButton.style.marginBottom = '4px';
        uploadButton.type = 'button';
        uploadButton.value = "Upload to handy";
        uploadButton.disabled = true;
        uploadButton.style.display = 'block';

        selecting.appendChild(inputText);

        selecting.appendChild(finputText);


        const inputOffset = document.createElement("label");
        inputOffset.innerHTML += 'Offset:<input class="input-text" style="display: inline-block; width: 200px; margin-left: 4px" type="number" name="Offset" value="0"><span> ms</span></label>';
        selecting.appendChild(inputOffset);

        selecting.appendChild(uploadButton);

        const inputOffsetI = inputOffset.getElementsByTagName("input")[0];
        inputOffsetI.style.marginBottom = '4px';

        var stats = document.createElement("a");
        stats.id="state";
        selecting.appendChild(stats);

        document.getElementsByClassName("controls-info")[0].prepend(selecting);


        //Video listening
        while (videoObj==null) {
            videoObj = getElementById('xplayer__video');
            await sleep(100);
        }

        inputOffsetI.addEventListener("keyup", function(event) {
            if (event.keyCode === 13) {
                event.preventDefault();
                hand.setOffset(inputOffsetI.value);
            }
        });

        inputText.addEventListener("blur", function(event) {
            handyKey = inputText.value;
            GM_setValue('handy_key', handyKey);
            if (scriptUrl && handyKey) {
                uploadButton.disabled = false;
            } else {
                uploadButton.disabled = true;
            }
        });
        inputText.addEventListener("keyup", function(event) {
            // Number 13 is the "Enter" key on the keyboard
            if (event.keyCode === 13) {
                // Cancel the default action, if needed
                event.preventDefault();
                handyKey = inputText.value;
                GM_setValue('handy_key', handyKey);
                console.log(scriptUrl);
                if (scriptUrl) {
                    uploadButton.disabled = false;
                } else {
                    uploadButton.disabled = true;
                }
            }
        });

        uploadButton.addEventListener("click", function(event) {
            event.preventDefault();
            hand.onReady(handyKey, scriptUrl);
        });

        finputText.addEventListener("change", function(event) {
            var files = event.target.files; // FileList object

            var filename = window.location.href.substr(window.location.href.indexOf("viewkey=")+8);

            var formData = new FormData();
            formData.set("syncFile", new File(files, filename + ".funscript")); //TODO: csv upload?

            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.handyfeeling.com/api/sync/upload",
                data:formData,
                context: {
                    scriptUrl: scriptUrl,
                },
                onload: function(response) {
                    var context = response.context || this.context || context;
                    var jsonResponse = response.responseText;
                    if (response.status == 200) {
                        document.getElementById("state").innerHTML += "<li>Script Uploaded to Handy Servers!</li>";
                        scriptUrl = JSON.parse(jsonResponse).url;
                        console.log(handyKey);
                        if (handyKey) {
                            uploadButton.disabled = false;
                        } else {
                            uploadButton.disabled = true;
                        }
                    } else {
                        document.getElementById("state").innerHTML += "<li>Error " + response.status + " occurred when trying to upload your file.</li>";
                    }
                    console.log(jsonResponse);
                }
            });

            event.preventDefault();
        }, false);

        videoObj.addEventListener("play", onplay);
        videoObj.addEventListener("playing", onplay);
        videoObj.addEventListener("progress", onplay);
        videoObj.addEventListener("pause", onpause);
        videoObj.addEventListener("waiting", onpause);

        console.log("Done!");
    }

    init();

})();
