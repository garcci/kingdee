export async function fetch(request, env, ctx) {
    // 只处理 GET 请求
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 });
    }

    try {
        // 获取用户信息（这里简化处理，实际可能需要从请求中获取用户标识）
        const username = await getUsername(request, env);
        if (!username) {
            return new Response("Username not found", { status: 400 });
        }

        // 构建单点登录URL
        const redirectUrl = await buildSSOUrl(env, username);

        // 记录日志用于调试
        console.log("SSO parameters: ", {
            dbId: env.X_KDAPI_ACCTID,
            username: username,
            appId: env.X_KDAPI_APPID,
            appSecret: env.X_KDAPI_APPSEC ? "[HIDDEN]" : "MISSING",
            lcId: env.X_KDAPI_LCID,
            serverUrl: env.X_KDAPI_SERVERURL,
            redirectUrl: redirectUrl
        });

        // 重定向到金蝶系统
        return Response.redirect(redirectUrl, 302);
    } catch (error) {
        console.error("SSO Error:", error);
        return new Response("Internal Server Error: " + error.message, { status: 500 });
    }
}

/**
 * 获取用户名
 * @param {Request} request - 请求对象
 * @param {Object} env - 环境变量
 * @returns {Promise<string>} 用户名
 */
async function getUsername(request, env) {
    // 这里应该根据实际需求实现用户身份验证逻辑
    // 比如从请求头、cookie或JWT中获取用户信息
    // 作为示例，我们直接返回一个测试用户名
    // 实际使用时应该根据业务需求实现

    // 示例：从请求参数中获取用户
    const { searchParams } = new URL(request.url);
    if (searchParams.has('user')) {
        return searchParams.get('user');
    }

    // 从请求头获取用户信息
    const userHeader = request.headers.get('x-user');
    if (userHeader) {
        return userHeader;
    }

    // 或者从环境变量中获取默认测试用户（仅用于测试）
    if (env.TEST_USER) {
        return env.TEST_USER;
    }

    // 实际实现中应该有真实的用户认证逻辑
    return null; // 不返回默认用户，而是返回null让调用方处理
}

/**
 * 构建单点登录URL
 * @param {Object} env - 环境变量
 * @param {string} username - 用户名
 * @returns {string} 单点登录URL
 */
async function buildSSOUrl(env, username) {
    // 从环境变量获取配置
    const dbId = env.X_KDAPI_ACCTID || "";
    const appId = env.X_KDAPI_APPID || "";
    const appSecret = env.X_KDAPI_APPSEC || "";
    const lcId = env.X_KDAPI_LCID || "2052"; // 默认简体中文
    const serverUrl = env.X_KDAPI_SERVERURL || "";

    if (!username) {
        throw new Error("Username is required");
    }

    if (!dbId || !appId || !appSecret || !serverUrl) {
        throw new Error("Missing required configuration in environment variables: dbId, appId, appSecret, and serverUrl must be set");
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const strArray = [dbId, username, appId, appSecret, timestamp.toString()];
    strArray.sort();

    // 与Java版本保持完全一致的字符串拼接方式
    let combStr = "";
    for (let i = 0; i < strArray.length; i++) {
        combStr += strArray[i];
    }

    // 使用更可靠的SHA1实现
    const strSign = sha1Hash(combStr);
    const sign = Array.from(new Uint8Array(strSign))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();

    // 构建参数字符串，与Java版本保持一致
    const urlPara = `{dbid:'${dbId}',username:'${username}',appid:'${appId}',signeddata:'${sign}',timestamp:'${timestamp}',lcid:'${lcId}',origintype:'simpas',formid:'',formtype:'bill',pkid:''}`;

    // 确保serverUrl以/结尾，然后拼接路径
    const normalizedServerUrl = serverUrl.endsWith('/') ? serverUrl : serverUrl + '/';
    return normalizedServerUrl + "html5/Index.aspx?ud=" + encodeURIComponent(urlPara);
}

/**
 * SHA1哈希算法实现（修复版）
 * @param {string} data - 要哈希的数据
 * @returns {ArrayBuffer} 哈希结果
 */
function sha1Hash(data) {
    const msg = unescape(encodeURIComponent(data));
    let H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];

    let W = new Array(80);
    let a, b, c, d, e, i, j, T;

    // 将字符串转换为字节数组
    let msgLen = msg.length;
    let wordArray = [];
    for (i = 0; i < msgLen - 3; i += 4) {
        j = msg.charCodeAt(i) << 24 | msg.charCodeAt(i + 1) << 16 |
            msg.charCodeAt(i + 2) << 8 | msg.charCodeAt(i + 3);
        wordArray.push(j);
    }

    switch (msgLen % 4) {
        case 0:
            i = 0x080000000;
            break;
        case 1:
            i = msg.charCodeAt(msgLen - 1) << 24 | 0x0800000;
            break;
        case 2:
            i = msg.charCodeAt(msgLen - 2) << 24 | msg.charCodeAt(msgLen - 1) << 16 | 0x08000;
            break;
        case 3:
            i = msg.charCodeAt(msgLen - 3) << 24 | msg.charCodeAt(msgLen - 2) << 16 |
                msg.charCodeAt(msgLen - 1) << 8 | 0x80;
            break;
    }

    wordArray.push(i);

    while ((wordArray.length % 16) !== 14) wordArray.push(0);

    wordArray.push(msgLen >>> 29);
    wordArray.push((msgLen << 3) & 0x0ffffffff);

    for (i = 0; i < wordArray.length; i += 16) {
        for (j = 0; j < 16; j++) W[j] = wordArray[i + j];
        for (j = 16; j < 80; j++) W[j] = rotateLeft(W[j - 3] ^ W[j - 8] ^ W[j - 14] ^ W[j - 16], 1);

        a = H[0]; b = H[1]; c = H[2]; d = H[3]; e = H[4];

        for (j = 0; j < 80; j++) {
            if (j < 20) {
                T = (rotateLeft(a, 5) + (b & c | ~b & d) + e + W[j] + 0x5A827999) & 0x0ffffffff;
            } else if (j < 40) {
                T = (rotateLeft(a, 5) + (b ^ c ^ d) + e + W[j] + 0x6ED9EBA1) & 0x0ffffffff;
            } else if (j < 60) {
                T = (rotateLeft(a, 5) + (b & c | b & d | c & d) + e + W[j] + 0x8F1BBCDC) & 0x0ffffffff;
            } else {
                T = (rotateLeft(a, 5) + (b ^ c ^ d) + e + W[j] + 0xCA62C1D6) & 0x0ffffffff;
            }

            e = d;
            d = c;
            c = rotateLeft(b, 30);
            b = a;
            a = T;
        }

        H[0] = (H[0] + a) & 0x0ffffffff;
        H[1] = (H[1] + b) & 0x0ffffffff;
        H[2] = (H[2] + c) & 0x0ffffffff;
        H[3] = (H[3] + d) & 0x0ffffffff;
        H[4] = (H[4] + e) & 0x0ffffffff;
    }

    // 创建返回的ArrayBuffer
    const result = new ArrayBuffer(20);
    const view = new DataView(result);
    view.setUint32(0, H[0], false);
    view.setUint32(4, H[1], false);
    view.setUint32(8, H[2], false);
    view.setUint32(12, H[3], false);
    view.setUint32(16, H[4], false);

    return result;
}

/**
 * 循环左移位操作
 * @param {number} value - 要移动的值
 * @param {number} shift - 移动位数
 * @returns {number} 移位后的值
 */
function rotateLeft(value, shift) {
    return ((value << shift) | (value >>> (32 - shift))) & 0xFFFFFFFF;
}

/**
 * 将字节数组转换为十六进制字符串
 * @param {ArrayBuffer} buffer - 字节数组
 * @returns {string} 十六进制字符串
 */
function bytesToHexString(buffer) {
    const bytes = new Uint8Array(buffer);
    if (!bytes || bytes.length === 0) {
        return null;
    }

    let result = '';
    for (let i = 0; i < bytes.length; i++) {
        const v = bytes[i] & 0xFF;
        const hv = v.toString(16).toUpperCase();
        if (hv.length < 2) {
            result += '0';
        }
        result += hv;
    }
    return result;
}