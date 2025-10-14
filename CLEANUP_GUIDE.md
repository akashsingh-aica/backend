# Application Cleanup & Shutdown Guide

## 🛑 Graceful Shutdown Implementation

The trading application implements comprehensive cleanup during shutdown to ensure:
- Database connections are properly closed
- Broker WebSocket connections are terminated
- Active trading sessions are cleaned up
- No memory leaks or hanging processes

## 🔧 Cleanup Architecture

### 1. **Signal Handling**
The application listens for shutdown signals:
```javascript
// OS signals
process.once('SIGTERM', gracefulShutdown);  // Docker/K8s shutdown
process.once('SIGINT', gracefulShutdown);   // Ctrl+C

// Error-triggered shutdown
process.on('uncaughtException', gracefulShutdown);
process.on('unhandledRejection', gracefulShutdown);
```

### 2. **Cleanup Sequence**
When shutdown is initiated:

1. **Stop accepting new requests** - Fastify server closes
2. **Clear intervals** - Periodic cleanup tasks stopped
3. **Trading service cleanup** - Expired sessions cleaned
4. **Broker connections** - All active broker instances disconnected
5. **Database cleanup** - MongoDB connection properly closed
6. **Other resources** - Any remaining resources cleaned up

### 3. **Timeout Protection**
- **Individual task timeout**: 5 seconds per cleanup task
- **Global shutdown timeout**: 8 seconds total
- **Force exit**: If cleanup hangs, process force-exits

## 📊 Cleanup Tasks Breakdown

### **Trading Service Cleanup**
```javascript
await TradingService.cleanupExpiredSessions();
```
- Marks expired sessions as inactive
- Removes cached broker instances
- Cleans up WebSocket connections

### **Broker Connections Cleanup**
```javascript
await this.cleanupBrokerConnections();
```
- Disconnects all active Zerodha/broker instances
- Closes WebSocket connections to market data
- Clears broker instance cache

### **Database Cleanup**
```javascript
await this.cleanupDatabase();
```
- Closes MongoDB connection gracefully
- Ensures all pending database operations complete
- Prevents connection pool leaks

### **Other Resources Cleanup**
```javascript
await this.cleanupOtherResources();
```
- Clears any remaining timeouts/intervals
- Closes file handles if any
- Future: Redis, cache, or other service connections

## 🧪 Testing Cleanup

### **Manual Testing**
```bash
# Start the server
npm run dev

# Test graceful shutdown (Ctrl+C)
^C

# Check logs for cleanup messages:
# ✅ Cleared session cleanup interval
# ✅ Trading service cleanup completed
# ✅ Broker connections cleanup completed
# ✅ Database cleanup completed
# ✅ Other resources cleanup completed
# 🎯 Comprehensive cleanup completed
# ✅ graceful shutdown complete
```

### **Docker/Production Testing**
```bash
# Send SIGTERM (Docker stop)
docker stop <container-id>

# Send SIGINT
kill -INT <process-id>
```

## 🔍 Monitoring Cleanup

### **Cleanup Logs**
The application logs each cleanup step:
```
🛑 initiating graceful shutdown
🧹 Starting comprehensive cleanup...
✅ Cleared session cleanup interval
✅ Trading service cleanup completed
✅ Broker connections cleanup completed
✅ Database cleanup completed
✅ Other resources cleanup completed
🎯 Comprehensive cleanup completed
✅ graceful shutdown complete
```

### **Error Handling**
If cleanup fails:
```
❌ Error during cleanup: <error message>
⏱️ forced exit after timeout  # If cleanup hangs
```

## 🚨 Common Cleanup Issues

### **1. Database Connection Hanging**
**Symptoms**: App doesn't exit cleanly
**Solution**: 
- Timeout protection automatically handles this
- Check MongoDB connection state
- Verify no long-running database operations

### **2. WebSocket Not Closing**
**Symptoms**: Process hangs on WebSocket connections
**Solution**:
- Broker disconnect includes WebSocket cleanup
- Timeout ensures force-exit if needed

### **3. Memory Leaks**
**Symptoms**: High memory usage during repeated start/stop
**Solution**:
- Intervals are properly cleared
- Broker instances are explicitly disconnected
- Database connections are closed

## 🔧 Adding New Cleanup Tasks

When adding new services that need cleanup:

### **1. Add to cleanup() method**
```javascript
// In server.js cleanup() method
cleanupTasks.push(
    Promise.race([
        this.cleanupYourNewService().then(() =>
            console.log('✅ Your service cleanup completed')
        ),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Your service cleanup timeout')), cleanupTimeout)
        )
    ])
);
```

### **2. Implement cleanup method**
```javascript
async cleanupYourNewService() {
    try {
        // Close connections
        // Clear caches
        // Stop background tasks
        console.log('🔧 Your service cleaned up');
    } catch (error) {
        console.warn('Warning during your service cleanup:', error.message);
    }
}
```

## 🐳 Docker Considerations

### **Dockerfile**
```dockerfile
# Use proper signal handling
CMD ["node", "src/server.js"]
# Not: CMD ["npm", "start"]  # This doesn't forward signals properly
```

### **Docker Compose**
```yaml
services:
  trading-app:
    # Allow time for graceful shutdown
    stop_grace_period: 10s
```

## ☸️ Kubernetes Considerations

### **Deployment**
```yaml
spec:
  template:
    spec:
      # Allow time for graceful shutdown
      terminationGracePeriodSeconds: 15
      containers:
      - name: trading-app
        # Ensure proper signal handling
        lifecycle:
          preStop:
            exec:
              command: ["/bin/sleep", "2"]
```

## 🔄 Best Practices

### **1. Always Use Timeouts**
- Individual task timeouts prevent hanging
- Global timeout ensures app doesn't hang indefinitely

### **2. Log Everything**
- Log each cleanup step for debugging
- Use structured logging in production

### **3. Handle Errors Gracefully**
- Don't throw errors during cleanup
- Log warnings instead of failing hard

### **4. Test Regularly**
- Test shutdown in all environments
- Monitor cleanup logs in production

### **5. Clean Up Resources**
- Close all connections
- Clear all intervals/timeouts
- Free up memory references

## 📚 Related Files

- **Server**: `src/server.js` - Main cleanup orchestration
- **Database**: `src/config/database.js` - Database disconnect
- **Trading Service**: `src/services/TradingService.js` - Broker cleanup
- **WebHooks**: `src/routes/webhooks.js` - Webhook cleanup (if needed)

---

**Remember**: Proper cleanup prevents resource leaks and ensures your application can be safely restarted in production environments!