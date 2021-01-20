/*eslint strict: ["error", "global"]*/
/*eslint no-invalid-this: "error"*/

'use strict';

var moment = require('moment');
require('moment-precise-range-plugin');
const globals = require('./globals');
const postToInfluxdb = require('./post-to-influxdb');

function serviceUptimeStart() {
    var uptimeLogLevel = globals.config.get('ButlerAuth.uptimeMonitor.logLevel'),
        uptimeInterval = globals.config.get('ButlerAuth.uptimeMonitor.frequency');

    // Formatter for numbers
    const formatter = new Intl.NumberFormat('en-US');

    // Log uptime to console
    Number.prototype.toTime = function (isSec) {
        var ms = isSec ? this * 1e3 : this,
            lm = ~(4 * !!isSec),
            /* limit fraction */
            fmt = new Date(ms).toISOString().slice(11, lm);

        if (ms >= 8.64e7) {
            /* >= 24 hours */
            var parts = fmt.split(/:(?=\d{2}:)/);
            parts[0] -= -24 * ((ms / 8.64e7) | 0);
            return parts.join(':');
        }

        return fmt;
    };

    var startTime = Date.now();
    var startIterations = 0;

    setInterval(function () {
        startIterations++;
        let uptimeMilliSec = Date.now() - startTime;
        moment.duration(uptimeMilliSec);

        let heapTotal = Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
            heapUsed = Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
            processMemory = Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
            external = Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100 ;

        globals.logger.log(uptimeLogLevel, '--------------------------------');
        globals.logger.log(
            uptimeLogLevel,
            'Iteration # ' +
                formatter.format(startIterations) +
                ', Uptime: ' +
                moment.preciseDiff(0, uptimeMilliSec) +
                `, Heap used ${heapUsed} MB of total heap ${heapTotal} MB. External (off-heap): ${external} MB. Memory allocated to process: ${processMemory} MB.`,
        );

        // Store to Influxdb
        let butlerAuthMemoryInfluxTag = globals.config.has(
            'ButlerAuth.uptimeMonitor.storeInInfluxdb.instanceTag',
        )
            ? globals.config.get('ButlerAuth.uptimeMonitor.storeInInfluxdb.instanceTag')
            : '';

        if (globals.config.get('ButlerAuth.uptimeMonitor.storeInInfluxdb.enable') == true) {
            postToInfluxdb.postButlerAuthMemoryUsageToInfluxdb({
                instanceTag: butlerAuthMemoryInfluxTag,
                heapUsed: heapUsed,
                heapTotal: heapTotal,
                external: external,
                processMemory: processMemory,
            });
        }
    }, uptimeInterval);
}

module.exports = {
    serviceUptimeStart,
};
