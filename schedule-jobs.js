"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const sleep = (ms) => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};
exports.scheduleJobs = (jobs, maxPerTimeFrame, timeFrame, afterBatchCallback) => __awaiter(void 0, void 0, void 0, function* () {
    const results = [];
    let remainingJobs = [...jobs];
    while (remainingJobs.length) {
        const currentJobs = remainingJobs.slice(0, maxPerTimeFrame);
        remainingJobs = remainingJobs.slice(maxPerTimeFrame);
        const startTime = process.hrtime();
        // eslint-disable-next-line no-await-in-loop
        results.push(...(yield Promise.all(currentJobs.map(job => job()))));
        const [seconds, ns] = process.hrtime(startTime);
        const ms = seconds * 1000 + ns / 1000000;
        if (afterBatchCallback) {
            afterBatchCallback(remainingJobs.length);
        }
        if (ms < timeFrame) {
            // eslint-disable-next-line no-await-in-loop
            yield sleep(timeFrame - ms);
        }
    }
    return results;
});
