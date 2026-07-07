            <div className="flex-1 overflow-y-auto p-4 space-y-2 relative">
              <AnimatePresence initial={false}>
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-3 leading-relaxed border-l-2 pl-3 py-0.5 ${
                      log.type === "trade_open" ? "border-blue-500 text-blue-100 bg-blue-900/10"
                      : log.type === "trade_close"
                        ? log.message.includes("+") ? "border-green-500 text-green-100 bg-green-900/10"
                          : "border-red-500 text-red-100 bg-red-900/10"
                        : log.type === "error" ? "border-red-500 text-red-400 bg-red-950/30"
                          : "border-gray-700 text-gray-400"
                    }`}
                  >
                    <span className="text-gray-600 shrink-0">[{log.time}]</span>
                    <span className="break-words">{log.message}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>