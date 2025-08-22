// ==UserScript==
// @name                Video Quality Fixer for X (Twitter)
// @name:es             Video en Alta Calidad para X (Twitter)
// @namespace           https://github.com/yuhaofe
// @namespace:es        https://github.com/CesarChris710
// @version             0.2.3
// @description         Force highest quality playback for X (Twitter) videos. Updated for 2025 interface.
// @description:es      Muestra la máxima calidad en los videos de X (Twitter). Actualizado 2025
// @author              yuhaofe (original) + royriv3r + CesarChris710
// @match               https://x.com/*
// @match               https://mobile.x.com/*
// @match               https://twitter.com/*
// @match               https://mobile.twitter.com/*
// @updateURL           https://cdn.jsdelivr.net/gh/CesarChris710/Video-Quality-Fixer-for-Twitter/vqfft.user.js
// @downloadURL         https://cdn.jsdelivr.net/gh/CesarChris710/Video-Quality-Fixer-for-Twitter/vqfft.user.js
// @grant               none
// ==/UserScript==

(function() {
    'use strict';

    // Configuration
    const config = {
        debug: false,
        forceHighestQuality: true,
        showQualityMark: true,
        showQualityBadge: true, // NEW: Show quality badge
        storageKey: 'vqfft-disablehq'
    };

    // Quality mapping based on bandwidth (kbps) to resolution
    const qualityMapping = [
        { minBandwidth: 0, maxBandwidth: 300, quality: "160p" },
        { minBandwidth: 300, maxBandwidth: 500, quality: "240p" },
        { minBandwidth: 500, maxBandwidth: 1000, quality: "360p" },
        { minBandwidth: 1000, maxBandwidth: 2000, quality: "480p" },
        { minBandwidth: 2000, maxBandwidth: 5000, quality: "720p" },
        { minBandwidth: 5000, maxBandwidth: 10000, quality: "1080p" },
        { minBandwidth: 10000, maxBandwidth: 15000, quality: "1440p" },
        { minBandwidth: 15000, maxBandwidth: Infinity, quality: "4K" }
    ];

    // Current video quality
    let currentQuality = 'Unknown';

    // Initialize components
    initHLSInterceptor();
    initUI();
    initQualityDisplay(); // NEW: Initialize quality display

    // Log helper
    function log(message) {
        if (config.debug) {
            console.log(`[Video Quality Fixer] ${message}`);
        }
    }

    // NEW: Function to determine quality from bandwidth
    function getQualityFromBandwidth(bandwidth) {
        const bandwidthKbps = Math.round(bandwidth / 1000);
        for (let mapping of qualityMapping) {
            if (bandwidthKbps >= mapping.minBandwidth && bandwidthKbps < mapping.maxBandwidth) {
                return mapping.quality;
            }
        }
        return 'Unknown';
    }

    // NEW: Function to extract resolution from EXT-X-STREAM-INF
    function getQualityFromResolution(text) {
        const resolutionMatch = text.match(/RESOLUTION=(\d+)x(\d+)/);
        if (resolutionMatch) {
            const height = parseInt(resolutionMatch[2]);
            if (height >= 2160) return '4K';
            if (height >= 1440) return '1440p';
            if (height >= 1080) return '1080p';
            if (height >= 720) return '720p';
            if (height >= 480) return '480p';
            if (height >= 360) return '360p';
            if (height >= 240) return '240p';
            return '160p';
        }
        return null;
    }

    // NEW: Create quality display overlay
    function createQualityOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'video-quality-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 14px;
            font-weight: bold;
            z-index: 9999;
            border: 2px solid #1d9bf0;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            display: none;
            pointer-events: none;
        `;
        overlay.textContent = `Quality: ${currentQuality}`;
        document.body.appendChild(overlay);
        return overlay;
    }

    // NEW: Show quality notification
    function showQualityNotification(quality) {
        if (!config.showQualityBadge) return;

        currentQuality = quality;
        let overlay = document.getElementById('video-quality-overlay');

        if (!overlay) {
            overlay = createQualityOverlay();
        }

        overlay.textContent = `${quality}`;
        overlay.style.display = 'block';

        // Hide after 5 seconds
        setTimeout(() => {
            overlay.style.display = 'none';
        }, 5000);

        log(`Video quality detected: ${quality}`);
    }

    // NEW: Initialize quality display system
    function initQualityDisplay() {
        log('Initializing quality display system');

        // Watch for video elements
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    const videos = document.querySelectorAll('video');
                    videos.forEach((video) => {
                        if (!video.hasAttribute('data-quality-watcher')) {
                            video.setAttribute('data-quality-watcher', 'true');

                            video.addEventListener('loadstart', () => {
                                log('Video started loading, checking quality...');
                            });

                            video.addEventListener('canplay', () => {
                                log('Video can play, quality should be determined');
                                if (currentQuality !== 'Unknown') {
                                    showQualityNotification(currentQuality);
                                }
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Enhanced HLS Interceptor with quality detection
    function initHLSInterceptor() {
        log('Initializing HLS interceptor with quality detection');

        const realOpen = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function() {
            const url = arguments[1];

            if (isHLSPlaylist(url)) {
                log(`Intercepted HLS playlist: ${url}`);

                this.addEventListener('readystatechange', function(e) {
                    if (this.readyState === 4) {
                        try {
                            const originalText = e.target.responseText;

                            if (isMasterPlaylist(originalText)) {
                                log('Master playlist detected, analyzing and modifying...');

                                // NEW: Extract quality information before modification
                                const qualityInfo = extractQualityInfo(originalText);

                                const modifiedText = modifyMasterPlaylist(originalText);

                                // NEW: Update current quality based on selection
                                if (qualityInfo.selectedQuality) {
                                    currentQuality = qualityInfo.selectedQuality;
                                    setTimeout(() => showQualityNotification(currentQuality), 1000);
                                }

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
            const hlsRegex = new RegExp(/^https:\/\/video\.twimg\.com\/.+\.m3u8(?:\?.+)?$/, 'i');
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

        // NEW: Extract quality information from master playlist
        function extractQualityInfo(text) {
            const streams = [];
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('#EXT-X-STREAM-INF:')) {
                    const streamInfo = lines[i];
                    const streamUrl = lines[i + 1];

                    // Extract bandwidth
                    const bandwidthMatch = streamInfo.match(/BANDWIDTH=(\d+)/);
                    const bandwidth = bandwidthMatch ? parseInt(bandwidthMatch[1]) : 0;

                    // Try to get quality from resolution first, then bandwidth
                    let quality = getQualityFromResolution(streamInfo);
                    if (!quality) {
                        quality = getQualityFromBandwidth(bandwidth);
                    }

                    streams.push({
                        bandwidth: bandwidth,
                        quality: quality,
                        url: streamUrl,
                        info: streamInfo
                    });
                }
            }

            // Sort by bandwidth to find highest quality
            streams.sort((a, b) => b.bandwidth - a.bandwidth);

            log(`Found ${streams.length} streams:`, streams.map(s => `${s.quality} (${Math.round(s.bandwidth/1000)}kbps)`).join(', '));

            return {
                streams: streams,
                selectedQuality: streams[0]?.quality || 'Unknown'
            };
        }

        function modifyMasterPlaylist(text) {
            if (!text) return text;

            let result = text;
            const reg = new RegExp(/^#EXT-X-STREAM-INF:.+BANDWIDTH=(\d+).*\r?\n(.+)$/gm);
            let stream = reg.exec(text);

            if (stream) {
                const globalTags = text.substring(0, stream.index);
                let maxBitrateStream = stream;

                while ((stream = reg.exec(text)) !== null) {
                    if (parseInt(stream[1]) > parseInt(maxBitrateStream[1])) {
                        maxBitrateStream = stream;
                    }
                }

                log(`Selected highest bitrate: ${maxBitrateStream[1]}kbps`);
                result = globalTags + maxBitrateStream[0];
            }

            return result;
        }
    }

})();