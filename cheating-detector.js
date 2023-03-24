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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cheerio_1 = __importDefault(require("cheerio"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const axios_1 = __importDefault(require("axios"));
const codeforces_client_1 = __importDefault(require("codeforces-client"));
const lodash_1 = __importDefault(require("lodash"));
const compare_code_1 = __importDefault(require("./compare-code"));
const schedule_jobs_1 = require("./schedule-jobs");
class CheatingDetector {
    constructor(cfUsername, cfPassword, groupId, contestId, blackList, requiredPercentage, codesMemo) {
        this.cfUsername = cfUsername;
        this.cfPassword = cfPassword;
        this.groupId = groupId;
        this.contestId = contestId;
        this.blackList = blackList;
        this.requiredPercentage = requiredPercentage;
        this.codesMemo = codesMemo;
        this.cookies = undefined;
        this.run = () => __awaiter(this, void 0, void 0, function* () {
            let authCookies;
            let parsedCookies;
            if (!this.cookies) {
                authCookies = yield this.login();
                parsedCookies = authCookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
                this.cookies = parsedCookies;
            }
            else {
                parsedCookies = this.cookies;
            }
            const submissions = yield this.generateSubmissionObjects();
            const codeJobs = submissions.map((submission) => () => this.getSourceCode(String(submission.id), parsedCookies));
            console.log(`[CF FETCH SOURCE CODE] START: ${codeJobs.length} submissions`);
            const jobsPerTimeFrame = Number(process.env.JOBS_PER_TIME_FRAME || 30);
            const timeFrame = Number(process.env.TIME_FRAME || 1000);
            const codes = yield schedule_jobs_1.scheduleJobs(codeJobs, jobsPerTimeFrame, timeFrame, remainingJobs => {
                console.log('REMAINING CODES TO FETCH:', remainingJobs);
            });
            console.log('[CF FETCH SOURCE CODE] DONE');
            submissions.forEach((submission, index) => {
                // eslint-disable-next-line no-param-reassign
                submission.code = codes[index];
                // eslint-disable-next-line no-param-reassign
                submission.url = this.generateSubmissionUrl(submission.id);
            });
            const cheatingCases = [];
            const groupedSubmissions = lodash_1.default.groupBy(submissions, 'index');
            // eslint-disable-next-line no-restricted-syntax
            Object.values(groupedSubmissions).forEach(problemSubmissions => {
                for (let i = 0; i < problemSubmissions.length; i += 1) {
                    for (let j = i + 1; j < problemSubmissions.length; j += 1) {
                        if (problemSubmissions[i].handle !== problemSubmissions[j].handle &&
                            problemSubmissions[i].index === problemSubmissions[j].index) {
                            const matchingPercentage = compare_code_1.default(problemSubmissions[i].code, problemSubmissions[j].code);
                            if (matchingPercentage >= this.requiredPercentage) {
                                cheatingCases.push({
                                    matchingPercentage,
                                    first: problemSubmissions[i],
                                    second: problemSubmissions[j],
                                });
                            }
                        }
                    }
                }
            });
            return cheatingCases.map(cheatingCase => (Object.assign(Object.assign({}, cheatingCase), { first: lodash_1.default.omit(cheatingCase.first, 'code'), second: lodash_1.default.omit(cheatingCase.second, 'code') })));
        });
        this.getSourceCode = (submissionId, cookies) => __awaiter(this, void 0, void 0, function* () {
            if (this.codesMemo.get(submissionId)) {
                return this.codesMemo.get(submissionId);
            }
            const submissionUrl = this.generateSubmissionUrl(submissionId);
            const result = yield axios_1.default.get(submissionUrl, {
                headers: {
                    Cookie: cookies,
                },
            });
            const $ = cheerio_1.default.load(result.data);
            this.codesMemo.set(submissionId, $('.prettyprint').text());
            return this.codesMemo.get(submissionId);
        });
    }
    login() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[CF LOGIN] START');
            const loginUrl = 'https://codeforces.com/enter';
            const browser = yield puppeteer_1.default.launch({
                args: ['--no-sandbox'],
                timeout: 0,
            });
            const page = yield browser.newPage();
            yield page.goto(loginUrl, { timeout: 0 });
            yield page.type('input[name="handleOrEmail"]', this.cfUsername);
            yield page.type('input[name="password"]', this.cfPassword);
            yield page.click('input[type="submit"]');
            yield page.waitForNavigation({ waitUntil: 'load', timeout: 0 });
            const cookies = yield page.cookies();
            browser.close();
            console.log('[CF LOGIN] DONE');
            return cookies;
        });
    }
    generateSubmissionObjects() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('[CF FETCH SUBMISSION] START');
            const client = new codeforces_client_1.default(process.env.CF_KEY, process.env.CF_SECRET);
            const submissions = yield client.contest.status({
                contestId: this.contestId,
            });
            console.log('[CF FETCH SUBMISSION] DONE');
            if (submissions.status !== 'OK') {
                throw new Error('API failed to fetch submissions');
            }
            return submissions.result
                .filter(submission => (submission.verdict ? submission.verdict === 'OK' : false) &&
                submission.author.participantType === 'CONTESTANT' &&
                this.blackList.includes(submission.problem.index) === false)
                .map(submission => ({
                id: submission.id,
                handle: submission.author.members[0].handle,
                index: submission.problem.index,
            }));
        });
    }
    generateSubmissionUrl(submissionId) {
        return `https://codeforces.com/group/${this.groupId}/contest/${this.contestId}/submission/${submissionId}`;
    }
}
exports.default = CheatingDetector;
