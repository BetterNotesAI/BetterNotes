/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
(() => {
var exports = {};
exports.id = "app/api/generate-latex/route";
exports.ids = ["app/api/generate-latex/route"];
exports.modules = {

/***/ "next/dist/compiled/next-server/app-page.runtime.dev.js":
/*!*************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-page.runtime.dev.js" ***!
  \*************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-page.runtime.dev.js");

/***/ }),

/***/ "next/dist/compiled/next-server/app-route.runtime.dev.js":
/*!**************************************************************************!*\
  !*** external "next/dist/compiled/next-server/app-route.runtime.dev.js" ***!
  \**************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/compiled/next-server/app-route.runtime.dev.js");

/***/ }),

/***/ "../app-render/work-async-storage.external":
/*!*****************************************************************************!*\
  !*** external "next/dist/server/app-render/work-async-storage.external.js" ***!
  \*****************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-async-storage.external.js");

/***/ }),

/***/ "./work-unit-async-storage.external":
/*!**********************************************************************************!*\
  !*** external "next/dist/server/app-render/work-unit-async-storage.external.js" ***!
  \**********************************************************************************/
/***/ ((module) => {

"use strict";
module.exports = require("next/dist/server/app-render/work-unit-async-storage.external.js");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fgenerate-latex%2Froute&page=%2Fapi%2Fgenerate-latex%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fgenerate-latex%2Froute.ts&appDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!":
/*!************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fgenerate-latex%2Froute&page=%2Fapi%2Fgenerate-latex%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fgenerate-latex%2Froute.ts&appDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D! ***!
  \************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   patchFetch: () => (/* binding */ patchFetch),\n/* harmony export */   routeModule: () => (/* binding */ routeModule),\n/* harmony export */   serverHooks: () => (/* binding */ serverHooks),\n/* harmony export */   workAsyncStorage: () => (/* binding */ workAsyncStorage),\n/* harmony export */   workUnitAsyncStorage: () => (/* binding */ workUnitAsyncStorage)\n/* harmony export */ });\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! next/dist/server/route-modules/app-route/module.compiled */ \"(rsc)/./node_modules/next/dist/server/route-modules/app-route/module.compiled.js\");\n/* harmony import */ var next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__);\n/* harmony import */ var next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! next/dist/server/route-kind */ \"(rsc)/./node_modules/next/dist/server/route-kind.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! next/dist/server/lib/patch-fetch */ \"(rsc)/./node_modules/next/dist/server/lib/patch-fetch.js\");\n/* harmony import */ var next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__);\n/* harmony import */ var _Users_martimassomoreno_Desktop_Marti_BetterNotesAI_BetterNotes2_BetterNotes_app_web_app_api_generate_latex_route_ts__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./app/api/generate-latex/route.ts */ \"(rsc)/./app/api/generate-latex/route.ts\");\n\n\n\n\n// We inject the nextConfigOutput here so that we can use them in the route\n// module.\nconst nextConfigOutput = \"\"\nconst routeModule = new next_dist_server_route_modules_app_route_module_compiled__WEBPACK_IMPORTED_MODULE_0__.AppRouteRouteModule({\n    definition: {\n        kind: next_dist_server_route_kind__WEBPACK_IMPORTED_MODULE_1__.RouteKind.APP_ROUTE,\n        page: \"/api/generate-latex/route\",\n        pathname: \"/api/generate-latex\",\n        filename: \"route\",\n        bundlePath: \"app/api/generate-latex/route\"\n    },\n    resolvedPagePath: \"/Users/martimassomoreno/Desktop/Martí/BetterNotesAI/BetterNotes2/BetterNotes/app-web/app/api/generate-latex/route.ts\",\n    nextConfigOutput,\n    userland: _Users_martimassomoreno_Desktop_Marti_BetterNotesAI_BetterNotes2_BetterNotes_app_web_app_api_generate_latex_route_ts__WEBPACK_IMPORTED_MODULE_3__\n});\n// Pull out the exports that we need to expose from the module. This should\n// be eliminated when we've moved the other routes to the new format. These\n// are used to hook into the route.\nconst { workAsyncStorage, workUnitAsyncStorage, serverHooks } = routeModule;\nfunction patchFetch() {\n    return (0,next_dist_server_lib_patch_fetch__WEBPACK_IMPORTED_MODULE_2__.patchFetch)({\n        workAsyncStorage,\n        workUnitAsyncStorage\n    });\n}\n\n\n//# sourceMappingURL=app-route.js.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvbmV4dC9kaXN0L2J1aWxkL3dlYnBhY2svbG9hZGVycy9uZXh0LWFwcC1sb2FkZXIvaW5kZXguanM/bmFtZT1hcHAlMkZhcGklMkZnZW5lcmF0ZS1sYXRleCUyRnJvdXRlJnBhZ2U9JTJGYXBpJTJGZ2VuZXJhdGUtbGF0ZXglMkZyb3V0ZSZhcHBQYXRocz0mcGFnZVBhdGg9cHJpdmF0ZS1uZXh0LWFwcC1kaXIlMkZhcGklMkZnZW5lcmF0ZS1sYXRleCUyRnJvdXRlLnRzJmFwcERpcj0lMkZVc2VycyUyRm1hcnRpbWFzc29tb3Jlbm8lMkZEZXNrdG9wJTJGTWFydGklQ0MlODElMkZCZXR0ZXJOb3Rlc0FJJTJGQmV0dGVyTm90ZXMyJTJGQmV0dGVyTm90ZXMlMkZhcHAtd2ViJTJGYXBwJnBhZ2VFeHRlbnNpb25zPXRzeCZwYWdlRXh0ZW5zaW9ucz10cyZwYWdlRXh0ZW5zaW9ucz1qc3gmcGFnZUV4dGVuc2lvbnM9anMmcm9vdERpcj0lMkZVc2VycyUyRm1hcnRpbWFzc29tb3Jlbm8lMkZEZXNrdG9wJTJGTWFydGklQ0MlODElMkZCZXR0ZXJOb3Rlc0FJJTJGQmV0dGVyTm90ZXMyJTJGQmV0dGVyTm90ZXMlMkZhcHAtd2ViJmlzRGV2PXRydWUmdHNjb25maWdQYXRoPXRzY29uZmlnLmpzb24mYmFzZVBhdGg9JmFzc2V0UHJlZml4PSZuZXh0Q29uZmlnT3V0cHV0PSZwcmVmZXJyZWRSZWdpb249Jm1pZGRsZXdhcmVDb25maWc9ZTMwJTNEISIsIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7OztBQUErRjtBQUN2QztBQUNxQjtBQUNxRTtBQUNsSjtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IseUdBQW1CO0FBQzNDO0FBQ0EsY0FBYyxrRUFBUztBQUN2QjtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBO0FBQ0EsWUFBWTtBQUNaLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxRQUFRLHNEQUFzRDtBQUM5RDtBQUNBLFdBQVcsNEVBQVc7QUFDdEI7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUMwRjs7QUFFMUYiLCJzb3VyY2VzIjpbIiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBBcHBSb3V0ZVJvdXRlTW9kdWxlIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvcm91dGUtbW9kdWxlcy9hcHAtcm91dGUvbW9kdWxlLmNvbXBpbGVkXCI7XG5pbXBvcnQgeyBSb3V0ZUtpbmQgfSBmcm9tIFwibmV4dC9kaXN0L3NlcnZlci9yb3V0ZS1raW5kXCI7XG5pbXBvcnQgeyBwYXRjaEZldGNoIGFzIF9wYXRjaEZldGNoIH0gZnJvbSBcIm5leHQvZGlzdC9zZXJ2ZXIvbGliL3BhdGNoLWZldGNoXCI7XG5pbXBvcnQgKiBhcyB1c2VybGFuZCBmcm9tIFwiL1VzZXJzL21hcnRpbWFzc29tb3Jlbm8vRGVza3RvcC9NYXJ0acyBL0JldHRlck5vdGVzQUkvQmV0dGVyTm90ZXMyL0JldHRlck5vdGVzL2FwcC13ZWIvYXBwL2FwaS9nZW5lcmF0ZS1sYXRleC9yb3V0ZS50c1wiO1xuLy8gV2UgaW5qZWN0IHRoZSBuZXh0Q29uZmlnT3V0cHV0IGhlcmUgc28gdGhhdCB3ZSBjYW4gdXNlIHRoZW0gaW4gdGhlIHJvdXRlXG4vLyBtb2R1bGUuXG5jb25zdCBuZXh0Q29uZmlnT3V0cHV0ID0gXCJcIlxuY29uc3Qgcm91dGVNb2R1bGUgPSBuZXcgQXBwUm91dGVSb3V0ZU1vZHVsZSh7XG4gICAgZGVmaW5pdGlvbjoge1xuICAgICAgICBraW5kOiBSb3V0ZUtpbmQuQVBQX1JPVVRFLFxuICAgICAgICBwYWdlOiBcIi9hcGkvZ2VuZXJhdGUtbGF0ZXgvcm91dGVcIixcbiAgICAgICAgcGF0aG5hbWU6IFwiL2FwaS9nZW5lcmF0ZS1sYXRleFwiLFxuICAgICAgICBmaWxlbmFtZTogXCJyb3V0ZVwiLFxuICAgICAgICBidW5kbGVQYXRoOiBcImFwcC9hcGkvZ2VuZXJhdGUtbGF0ZXgvcm91dGVcIlxuICAgIH0sXG4gICAgcmVzb2x2ZWRQYWdlUGF0aDogXCIvVXNlcnMvbWFydGltYXNzb21vcmVuby9EZXNrdG9wL01hcnRpzIEvQmV0dGVyTm90ZXNBSS9CZXR0ZXJOb3RlczIvQmV0dGVyTm90ZXMvYXBwLXdlYi9hcHAvYXBpL2dlbmVyYXRlLWxhdGV4L3JvdXRlLnRzXCIsXG4gICAgbmV4dENvbmZpZ091dHB1dCxcbiAgICB1c2VybGFuZFxufSk7XG4vLyBQdWxsIG91dCB0aGUgZXhwb3J0cyB0aGF0IHdlIG5lZWQgdG8gZXhwb3NlIGZyb20gdGhlIG1vZHVsZS4gVGhpcyBzaG91bGRcbi8vIGJlIGVsaW1pbmF0ZWQgd2hlbiB3ZSd2ZSBtb3ZlZCB0aGUgb3RoZXIgcm91dGVzIHRvIHRoZSBuZXcgZm9ybWF0LiBUaGVzZVxuLy8gYXJlIHVzZWQgdG8gaG9vayBpbnRvIHRoZSByb3V0ZS5cbmNvbnN0IHsgd29ya0FzeW5jU3RvcmFnZSwgd29ya1VuaXRBc3luY1N0b3JhZ2UsIHNlcnZlckhvb2tzIH0gPSByb3V0ZU1vZHVsZTtcbmZ1bmN0aW9uIHBhdGNoRmV0Y2goKSB7XG4gICAgcmV0dXJuIF9wYXRjaEZldGNoKHtcbiAgICAgICAgd29ya0FzeW5jU3RvcmFnZSxcbiAgICAgICAgd29ya1VuaXRBc3luY1N0b3JhZ2VcbiAgICB9KTtcbn1cbmV4cG9ydCB7IHJvdXRlTW9kdWxlLCB3b3JrQXN5bmNTdG9yYWdlLCB3b3JrVW5pdEFzeW5jU3RvcmFnZSwgc2VydmVySG9va3MsIHBhdGNoRmV0Y2gsICB9O1xuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1hcHAtcm91dGUuanMubWFwIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fgenerate-latex%2Froute&page=%2Fapi%2Fgenerate-latex%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fgenerate-latex%2Froute.ts&appDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!\n");

/***/ }),

/***/ "(rsc)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(ssr)/./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true!":
/*!******************************************************************************************************!*\
  !*** ./node_modules/next/dist/build/webpack/loaders/next-flight-client-entry-loader.js?server=true! ***!
  \******************************************************************************************************/
/***/ (() => {



/***/ }),

/***/ "(rsc)/./app/api/_proxy.ts":
/*!***************************!*\
  !*** ./app/api/_proxy.ts ***!
  \***************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   getApiBaseUrl: () => (/* binding */ getApiBaseUrl),\n/* harmony export */   jsonError: () => (/* binding */ jsonError)\n/* harmony export */ });\n// Shared helpers for Next.js API proxy routes → app-api\nfunction getApiBaseUrl() {\n    return (process.env.API_BASE_URL ?? \"\").replace(/\\/$/, \"\");\n}\nfunction jsonError(status, error) {\n    return new Response(JSON.stringify({\n        error\n    }), {\n        status,\n        headers: {\n            \"Content-Type\": \"application/json\"\n        }\n    });\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL19wcm94eS50cyIsIm1hcHBpbmdzIjoiOzs7OztBQUFBLHdEQUF3RDtBQUVqRCxTQUFTQTtJQUNkLE9BQU8sQ0FBQ0MsUUFBUUMsR0FBRyxDQUFDQyxZQUFZLElBQUksRUFBQyxFQUFHQyxPQUFPLENBQUMsT0FBTztBQUN6RDtBQUVPLFNBQVNDLFVBQVVDLE1BQWMsRUFBRUMsS0FBYTtJQUNyRCxPQUFPLElBQUlDLFNBQVNDLEtBQUtDLFNBQVMsQ0FBQztRQUFFSDtJQUFNLElBQUk7UUFDN0NEO1FBQ0FLLFNBQVM7WUFBRSxnQkFBZ0I7UUFBbUI7SUFDaEQ7QUFDRiIsInNvdXJjZXMiOlsiL1VzZXJzL21hcnRpbWFzc29tb3Jlbm8vRGVza3RvcC9NYXJ0acyBL0JldHRlck5vdGVzQUkvQmV0dGVyTm90ZXMyL0JldHRlck5vdGVzL2FwcC13ZWIvYXBwL2FwaS9fcHJveHkudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gU2hhcmVkIGhlbHBlcnMgZm9yIE5leHQuanMgQVBJIHByb3h5IHJvdXRlcyDihpIgYXBwLWFwaVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QXBpQmFzZVVybCgpIHtcbiAgcmV0dXJuIChwcm9jZXNzLmVudi5BUElfQkFTRV9VUkwgPz8gXCJcIikucmVwbGFjZSgvXFwvJC8sIFwiXCIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24ganNvbkVycm9yKHN0YXR1czogbnVtYmVyLCBlcnJvcjogc3RyaW5nKSB7XG4gIHJldHVybiBuZXcgUmVzcG9uc2UoSlNPTi5zdHJpbmdpZnkoeyBlcnJvciB9KSwge1xuICAgIHN0YXR1cyxcbiAgICBoZWFkZXJzOiB7IFwiQ29udGVudC1UeXBlXCI6IFwiYXBwbGljYXRpb24vanNvblwiIH0sXG4gIH0pO1xufVxuIl0sIm5hbWVzIjpbImdldEFwaUJhc2VVcmwiLCJwcm9jZXNzIiwiZW52IiwiQVBJX0JBU0VfVVJMIiwicmVwbGFjZSIsImpzb25FcnJvciIsInN0YXR1cyIsImVycm9yIiwiUmVzcG9uc2UiLCJKU09OIiwic3RyaW5naWZ5IiwiaGVhZGVycyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./app/api/_proxy.ts\n");

/***/ }),

/***/ "(rsc)/./app/api/generate-latex/route.ts":
/*!*****************************************!*\
  !*** ./app/api/generate-latex/route.ts ***!
  \*****************************************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   POST: () => (/* binding */ POST),\n/* harmony export */   runtime: () => (/* binding */ runtime)\n/* harmony export */ });\n/* harmony import */ var _proxy__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../_proxy */ \"(rsc)/./app/api/_proxy.ts\");\nconst runtime = \"nodejs\";\n\nasync function POST(req) {\n    const baseUrl = (0,_proxy__WEBPACK_IMPORTED_MODULE_0__.getApiBaseUrl)();\n    if (!baseUrl) return (0,_proxy__WEBPACK_IMPORTED_MODULE_0__.jsonError)(500, \"API_BASE_URL is not set.\");\n    const body = await req.text();\n    const contentType = req.headers.get(\"content-type\") ?? \"application/json\";\n    try {\n        const upstream = await fetch(`${baseUrl}/latex/generate-latex`, {\n            method: \"POST\",\n            headers: {\n                \"Content-Type\": contentType\n            },\n            body\n        });\n        const responseBody = await upstream.text();\n        const responseContentType = upstream.headers.get(\"content-type\") ?? \"application/json\";\n        return new Response(responseBody, {\n            status: upstream.status,\n            headers: {\n                \"Content-Type\": responseContentType\n            }\n        });\n    } catch (error) {\n        const message = error instanceof Error ? error.message : \"Unknown upstream error.\";\n        return (0,_proxy__WEBPACK_IMPORTED_MODULE_0__.jsonError)(502, `Cannot reach app-api at ${baseUrl}. (${message})`);\n    }\n}\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9hcHAvYXBpL2dlbmVyYXRlLWxhdGV4L3JvdXRlLnRzIiwibWFwcGluZ3MiOiI7Ozs7OztBQUFPLE1BQU1BLFVBQVUsU0FBUztBQUVxQjtBQUU5QyxlQUFlRyxLQUFLQyxHQUFZO0lBQ3JDLE1BQU1DLFVBQVVKLHFEQUFhQTtJQUM3QixJQUFJLENBQUNJLFNBQVMsT0FBT0gsaURBQVNBLENBQUMsS0FBSztJQUVwQyxNQUFNSSxPQUFPLE1BQU1GLElBQUlHLElBQUk7SUFDM0IsTUFBTUMsY0FBY0osSUFBSUssT0FBTyxDQUFDQyxHQUFHLENBQUMsbUJBQW1CO0lBRXZELElBQUk7UUFDRixNQUFNQyxXQUFXLE1BQU1DLE1BQU0sR0FBR1AsUUFBUSxxQkFBcUIsQ0FBQyxFQUFFO1lBQzlEUSxRQUFRO1lBQ1JKLFNBQVM7Z0JBQUUsZ0JBQWdCRDtZQUFZO1lBQ3ZDRjtRQUNGO1FBRUEsTUFBTVEsZUFBZSxNQUFNSCxTQUFTSixJQUFJO1FBQ3hDLE1BQU1RLHNCQUFzQkosU0FBU0YsT0FBTyxDQUFDQyxHQUFHLENBQUMsbUJBQW1CO1FBRXBFLE9BQU8sSUFBSU0sU0FBU0YsY0FBYztZQUNoQ0csUUFBUU4sU0FBU00sTUFBTTtZQUN2QlIsU0FBUztnQkFBRSxnQkFBZ0JNO1lBQW9CO1FBQ2pEO0lBQ0YsRUFBRSxPQUFPRyxPQUFPO1FBQ2QsTUFBTUMsVUFBVUQsaUJBQWlCRSxRQUFRRixNQUFNQyxPQUFPLEdBQUc7UUFDekQsT0FBT2pCLGlEQUFTQSxDQUFDLEtBQUssQ0FBQyx3QkFBd0IsRUFBRUcsUUFBUSxHQUFHLEVBQUVjLFFBQVEsQ0FBQyxDQUFDO0lBQzFFO0FBQ0YiLCJzb3VyY2VzIjpbIi9Vc2Vycy9tYXJ0aW1hc3NvbW9yZW5vL0Rlc2t0b3AvTWFydGnMgS9CZXR0ZXJOb3Rlc0FJL0JldHRlck5vdGVzMi9CZXR0ZXJOb3Rlcy9hcHAtd2ViL2FwcC9hcGkvZ2VuZXJhdGUtbGF0ZXgvcm91dGUudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGNvbnN0IHJ1bnRpbWUgPSBcIm5vZGVqc1wiO1xuXG5pbXBvcnQgeyBnZXRBcGlCYXNlVXJsLCBqc29uRXJyb3IgfSBmcm9tIFwiLi4vX3Byb3h5XCI7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBQT1NUKHJlcTogUmVxdWVzdCkge1xuICBjb25zdCBiYXNlVXJsID0gZ2V0QXBpQmFzZVVybCgpO1xuICBpZiAoIWJhc2VVcmwpIHJldHVybiBqc29uRXJyb3IoNTAwLCBcIkFQSV9CQVNFX1VSTCBpcyBub3Qgc2V0LlwiKTtcblxuICBjb25zdCBib2R5ID0gYXdhaXQgcmVxLnRleHQoKTtcbiAgY29uc3QgY29udGVudFR5cGUgPSByZXEuaGVhZGVycy5nZXQoXCJjb250ZW50LXR5cGVcIikgPz8gXCJhcHBsaWNhdGlvbi9qc29uXCI7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCB1cHN0cmVhbSA9IGF3YWl0IGZldGNoKGAke2Jhc2VVcmx9L2xhdGV4L2dlbmVyYXRlLWxhdGV4YCwge1xuICAgICAgbWV0aG9kOiBcIlBPU1RcIixcbiAgICAgIGhlYWRlcnM6IHsgXCJDb250ZW50LVR5cGVcIjogY29udGVudFR5cGUgfSxcbiAgICAgIGJvZHksXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZUJvZHkgPSBhd2FpdCB1cHN0cmVhbS50ZXh0KCk7XG4gICAgY29uc3QgcmVzcG9uc2VDb250ZW50VHlwZSA9IHVwc3RyZWFtLmhlYWRlcnMuZ2V0KFwiY29udGVudC10eXBlXCIpID8/IFwiYXBwbGljYXRpb24vanNvblwiO1xuXG4gICAgcmV0dXJuIG5ldyBSZXNwb25zZShyZXNwb25zZUJvZHksIHtcbiAgICAgIHN0YXR1czogdXBzdHJlYW0uc3RhdHVzLFxuICAgICAgaGVhZGVyczogeyBcIkNvbnRlbnQtVHlwZVwiOiByZXNwb25zZUNvbnRlbnRUeXBlIH0sXG4gICAgfSk7XG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogXCJVbmtub3duIHVwc3RyZWFtIGVycm9yLlwiO1xuICAgIHJldHVybiBqc29uRXJyb3IoNTAyLCBgQ2Fubm90IHJlYWNoIGFwcC1hcGkgYXQgJHtiYXNlVXJsfS4gKCR7bWVzc2FnZX0pYCk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJydW50aW1lIiwiZ2V0QXBpQmFzZVVybCIsImpzb25FcnJvciIsIlBPU1QiLCJyZXEiLCJiYXNlVXJsIiwiYm9keSIsInRleHQiLCJjb250ZW50VHlwZSIsImhlYWRlcnMiLCJnZXQiLCJ1cHN0cmVhbSIsImZldGNoIiwibWV0aG9kIiwicmVzcG9uc2VCb2R5IiwicmVzcG9uc2VDb250ZW50VHlwZSIsIlJlc3BvbnNlIiwic3RhdHVzIiwiZXJyb3IiLCJtZXNzYWdlIiwiRXJyb3IiXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./app/api/generate-latex/route.ts\n");

/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../../webpack-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = __webpack_require__.X(0, ["vendor-chunks/next"], () => (__webpack_exec__("(rsc)/./node_modules/next/dist/build/webpack/loaders/next-app-loader/index.js?name=app%2Fapi%2Fgenerate-latex%2Froute&page=%2Fapi%2Fgenerate-latex%2Froute&appPaths=&pagePath=private-next-app-dir%2Fapi%2Fgenerate-latex%2Froute.ts&appDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web%2Fapp&pageExtensions=tsx&pageExtensions=ts&pageExtensions=jsx&pageExtensions=js&rootDir=%2FUsers%2Fmartimassomoreno%2FDesktop%2FMarti%CC%81%2FBetterNotesAI%2FBetterNotes2%2FBetterNotes%2Fapp-web&isDev=true&tsconfigPath=tsconfig.json&basePath=&assetPrefix=&nextConfigOutput=&preferredRegion=&middlewareConfig=e30%3D!")));
module.exports = __webpack_exports__;

})();