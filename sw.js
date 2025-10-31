// sw.js - Service Worker for offline functionality

const CACHE_NAME = 'kingdee-sso-v1.1';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// 安装事件 - 缓存静态资源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 获取事件 - 实现离线功能
self.addEventListener('fetch', event => {
  // 对于非GET请求，直接转发
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到了响应，直接返回
        if (response) {
          return response;
        }
        
        // 克隆请求
        const fetchRequest = event.request.clone();
        
        // 尝试从网络获取
        return fetch(fetchRequest).then(response => {
          // 检查响应是否有效
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // 克隆响应
          const responseToCache = response.clone();
          
          // 将响应缓存起来
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
            
          return response;
        }).catch(() => {
          // 如果获取失败且请求的是HTML页面，则返回缓存的首页
          if (event.request.headers.get('accept').includes('text/html')) {
            return caches.match('./index.html');
          }
        });
      })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// 监听消息事件，支持手动更新缓存
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});