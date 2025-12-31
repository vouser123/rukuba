(function (global) {
    const ENCODING = 'gzip+base64';
    const FORMAT = 'V2';
    const TYPE_MARKERS = {
        PT_MODIFICATIONS: {
            start: '\u2013START_PT_MODIFICATIONS_V2\u2013',
            end: '\u2013END_PT_MODIFICATIONS_V2\u2013'
        },
        PT_DATA: {
            start: '\u2013START_PT_DATA_V2\u2013',
            end: '\u2013END_PT_DATA_V2\u2013'
        }
    };

    const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

    function utf8Bytes(str) {
        return new TextEncoder().encode(str);
    }

    function utf8ByteLength(str) {
        return utf8Bytes(str).length;
    }

    async function sha256Hex(bytes) {
        if (global.crypto && global.crypto.subtle) {
            const hashBuffer = await global.crypto.subtle.digest('SHA-256', bytes);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        }
        if (typeof require !== 'undefined') {
            const crypto = require('crypto');
            return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
        }
        throw new Error('SHA-256 not supported in this environment.');
    }

    function canonicalizeObj(obj) {
        // Canonical representation for size + checksum calculations.
        return JSON.stringify(obj);
    }

    function base64FromBytes(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64');
        }
        let binary = '';
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, i + chunkSize);
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    }

    function bytesFromBase64(str) {
        if (typeof Buffer !== 'undefined') {
            return new Uint8Array(Buffer.from(str, 'base64'));
        }
        const binary = atob(str);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    async function gzipToBase64(bytes) {
        let compressed;
        if (isNode) {
            const zlib = require('zlib');
            compressed = zlib.gzipSync(Buffer.from(bytes));
        } else if (typeof CompressionStream !== 'undefined') {
            const stream = new CompressionStream('gzip');
            const writer = stream.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const response = new Response(stream.readable);
            const buffer = await response.arrayBuffer();
            compressed = new Uint8Array(buffer);
        } else if (typeof pako !== 'undefined') {
            compressed = pako.gzip(bytes);
        } else {
            throw new Error('Gzip compression is not available in this browser.');
        }
        return base64FromBytes(compressed);
    }

    async function base64ToGunzipBytes(str) {
        const cleaned = str.replace(/\s+/g, '');
        const bytes = bytesFromBase64(cleaned);
        if (isNode) {
            const zlib = require('zlib');
            return new Uint8Array(zlib.gunzipSync(Buffer.from(bytes)));
        }
        if (typeof DecompressionStream !== 'undefined') {
            const stream = new DecompressionStream('gzip');
            const writer = stream.writable.getWriter();
            writer.write(bytes);
            writer.close();
            const response = new Response(stream.readable);
            const buffer = await response.arrayBuffer();
            return new Uint8Array(buffer);
        }
        if (typeof pako !== 'undefined') {
            return pako.ungzip(bytes);
        }
        throw new Error('Gzip decompression is not available in this browser.');
    }

    function wrapBase64(str, lineLen = 76) {
        if (!str) return '';
        const lines = [];
        for (let i = 0; i < str.length; i += lineLen) {
            lines.push(str.slice(i, i + lineLen));
        }
        return lines.join('\n');
    }

    async function buildV2Block({ type, obj }) {
        if (!TYPE_MARKERS[type]) {
            throw new Error(`Unsupported type: ${type}`);
        }
        // Canonicalize (JSON.stringify) before hashing so whitespace changes never affect SIZE/CHECKSUM.
        const canonical = canonicalizeObj(obj);
        const bytes = utf8Bytes(canonical);
        const size = bytes.length;
        const checksum = await sha256Hex(bytes);
        const base64 = await gzipToBase64(bytes);
        const wrapped = wrapBase64(base64);
        const headers = [
            `FORMAT: ${FORMAT}`,
            `ENCODING: ${ENCODING}`,
            `TYPE: ${type}`,
            `SIZE: ${size}`,
            `CHECKSUM: ${checksum}`
        ];
        const marker = TYPE_MARKERS[type];
        return `${marker.start}\n${headers.join('\n')}\n${wrapped}\n${marker.end}`;
    }

    function collectBlocks(text) {
        const blocks = [];
        Object.keys(TYPE_MARKERS).forEach((type) => {
            const marker = TYPE_MARKERS[type];
            const regex = new RegExp(`^[\\t ]*${marker.start}[\\t ]*$([\\s\\S]*?)^[\\t ]*${marker.end}[\\t ]*$`, 'gm');
            let match;
            while ((match = regex.exec(text)) !== null) {
                blocks.push({
                    type,
                    index: match.index,
                    content: match[1]
                });
            }
        });
        blocks.sort((a, b) => a.index - b.index);
        return blocks;
    }

    async function parseV2FromText(pastedText, preferredType) {
        const result = {
            type: null,
            obj: null,
            meta: {},
            computed: {},
            errors: []
        };

        const blocks = collectBlocks(pastedText);
        if (blocks.length === 0) {
            result.errors.push('No V2 payload markers found. Make sure you copied the block starting with –START_PT_…_V2–.');
            return result;
        }

        let block = blocks[0];
        if (preferredType) {
            const preferredBlock = blocks.find((entry) => entry.type === preferredType);
            if (preferredBlock) {
                block = preferredBlock;
            }
        }

        result.type = block.type;

        const lines = block.content.split(/\r?\n/);
        const headerRegex = /^([A-Z_]+)\s*:\s*(.+)$/;
        const headers = {};
        let payloadStart = 0;
        let sawHeader = false;
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i].trim();
            if (!line && !sawHeader) {
                continue;
            }
            const match = line.match(headerRegex);
            if (!match) {
                payloadStart = i;
                break;
            }
            headers[match[1]] = match[2];
            payloadStart = i + 1;
            sawHeader = true;
        }

        const payloadLines = lines.slice(payloadStart);
        const requiredHeaders = ['FORMAT', 'ENCODING', 'TYPE', 'SIZE', 'CHECKSUM'];
        const missingHeaders = requiredHeaders.filter((key) => !headers[key]);

        result.meta = {
            format: headers.FORMAT,
            encoding: headers.ENCODING,
            type: headers.TYPE,
            size: headers.SIZE ? Number(headers.SIZE) : null,
            checksum: headers.CHECKSUM
        };

        if (missingHeaders.length > 0) {
            result.errors.push(`Invalid V2 payload headers. Missing: ${missingHeaders.join(', ')}.`);
            return result;
        }

        if (headers.FORMAT !== FORMAT) {
            result.errors.push(`Unsupported format: ${headers.FORMAT}. Only V2 payloads are accepted.`);
            return result;
        }

        if (!TYPE_MARKERS[headers.TYPE]) {
            result.errors.push(`Unsupported payload type: ${headers.TYPE}.`);
            return result;
        }

        if (headers.TYPE !== block.type) {
            result.errors.push(`Header TYPE (${headers.TYPE}) does not match marker (${block.type}).`);
            return result;
        }

        if (headers.ENCODING !== ENCODING) {
            result.errors.push(`Unsupported encoding: ${headers.ENCODING}. Expected ${ENCODING}.`);
            return result;
        }

        const payload = payloadLines.join('').replace(/\s+/g, '');

        try {
            const inflated = await base64ToGunzipBytes(payload);
            const decoded = new TextDecoder().decode(inflated);
            const obj = JSON.parse(decoded);
            const canonical = canonicalizeObj(obj);
            const canonicalBytes = utf8Bytes(canonical);
            const computedSize = canonicalBytes.length;
            const computedChecksum = await sha256Hex(canonicalBytes);

            result.obj = obj;
            result.computed = {
                size: computedSize,
                checksum: computedChecksum,
                canonical
            };

            const expectedSize = Number(headers.SIZE);
            const expectedChecksum = headers.CHECKSUM;

            if (computedSize !== expectedSize || computedChecksum !== expectedChecksum) {
                result.errors.push(
                    `V2 payload verification failed.\n\n` +
                    `Detected TYPE: ${headers.TYPE}\n` +
                    `Detected ENCODING: ${headers.ENCODING}\n` +
                    `Expected SIZE: ${expectedSize} bytes\n` +
                    `Computed SIZE: ${computedSize} bytes\n` +
                    `Expected CHECKSUM: ${expectedChecksum.slice(0, 12)}…\n` +
                    `Computed CHECKSUM: ${computedChecksum.slice(0, 12)}…\n\n` +
                    `Your paste was likely truncated (common on iOS for long text). Re-export and use “Copy payload only”.`
                );
            }
        } catch (err) {
            result.errors.push(
                `Unable to decode V2 payload. ${err.message}\n\n` +
                `Your paste was likely truncated (common on iOS for long text). Re-export and use “Copy payload only”.`
            );
        }

        return result;
    }

    const api = {
        utf8Bytes,
        utf8ByteLength,
        sha256Hex,
        canonicalizeObj,
        gzipToBase64,
        base64ToGunzipBytes,
        wrapBase64,
        buildV2Block,
        parseV2FromText
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        global.ptPayloadUtils = api;
    }
})(typeof window !== 'undefined' ? window : globalThis);
