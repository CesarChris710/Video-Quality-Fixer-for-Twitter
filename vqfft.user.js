// ==UserScript==
// @name                Video Quality Fixer for X (Twitter)
// @namespace           https://github.com/yuhaofe
// @version             0.2.2
// @description         Force highest quality playback for X (Twitter) videos. Updated for 2025 interface.
// @author              yuhaofe (original) + royriv3r
// @match               https://x.com/*
// @match               https://mobile.x.com/*
// @match               https://twitter.com/*
// @match               https://mobile.twitter.com/*
// @grant               none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        debug: false,
        forceHighestQuality: true,
        showQualityMark: true,
        storageKey: 'vqfft-disablehq'
    };

    // Initialize components
    initHLSInterceptor();
    initUI();

    // Log helper
    function log(message) {
        if (config.debug) {
            console.log(`[Video Quality Fixer] ${message}`);
        }
    }

    // HLS Interceptor
    function initHLSInterceptor() {
        log('Initializing HLS interceptor');

        const realOpen = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function() {
            const url = arguments['1'];
            if (isHLSPlaylist(url)) {
                log(`Intercepted HLS playlist: ${url}`);
                this.addEventListener('readystatechange', function(e) {
                    if (this.readyState === 4) {
                        try {
                            const originalText = e.target.responseText;
                            if (isMasterPlaylist(originalText)) {
                                log('Master playlist detected, modifying...');
                                const modifiedText = modifyMasterPlaylist(originalText);
                                Object.defineProperty(this, 'response', {writable: true});
                                Object.defineProperty(this, 'responseText', {writable: true});
                                this.response = this.responseText = modifiedText;
                            } else if (isMediaPlaylist(originalText)) {
                                log('Media playlist detected, no modification needed');
                            }
                        } catch (error) {
                            log(`Error processing XHR response: ${error.message}`);
                        }
                    }
                });
            }
            return realOpen.apply(this, arguments);
        };

        function isHLSPlaylist(url) {
            if (!url) return false;

            const hlsRegex = new RegExp(/^https:\/\/video\.twimg\.com\/.*\.m3u8(?:\?.*)?$/, 'i');
            return hlsRegex.test(url);
        }

        function isMasterPlaylist(text) {
            if (!text) return false;
            return text.indexOf('#EXT-X-TARGETDURATION') === -1 && text.indexOf('#EXT-X-STREAM-INF') !== -1;
        }

        function isMediaPlaylist(text) {
            if (!text) return false;
            return text.indexOf('#EXT-X-TARGETDURATION') !== -1;
        }

        function modifyMasterPlaylist(text) {
            if (!text) return text;

            let result = text;
            const reg = new RegExp(/^#EXT-X-STREAM-INF:.*BANDWIDTH=(\d+).*\r?\n(.*)$/, 'gm');
            let stream = reg.exec(text);

            if (stream) {
                const globalTags = text.substring(0, stream.index);

                let maxBitrateStream = stream;
                while ((stream = reg.exec(text)) !== null) {
                    if (parseInt(stream[1]) > parseInt(maxBitrateStream[1])) {
                        maxBitrateStream = stream;
                    }
                }

                log(`Selected highest bitrate: ${maxBitrateStream[1]}`);
                result = globalTags + maxBitrateStream[0];
            }

            return result;
        }
    }

    // UI Component
    function initUI() {
        if (!config.showQualityMark) return;

        const disableHQ = localStorage.getItem(config.storageKey);
        if (disableHQ) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createHQMark);
        } else {
            createHQMark();
        }

        function createHQMark() {
            const mark = document.createElement('button');
            mark.innerText = 'HQ';
            mark.style = "position: fixed;right: 5px;top: 5px;color: white;border-width: 0px;border-radius: 5px;background-color: gray;opacity: 0.5;";
            mark.title = "Video Quality Fixer is active";

            mark.onclick = function() {
                if (confirm('Désactiver le marqueur HQ ?')) {
                    localStorage.setItem(config.storageKey, 'true');
                    mark.remove();
                }
            };

            document.body.appendChild(mark);
        }
    }
})();