# MCP X++ Server - Technical Architecture

**Document Version:** 1.1  
**Last Updated:** January 31, 2026  
**Status:** Current Implementation Documentation

This document provides detailed technical architecture information for the MCP X++ Server project.

## Modular Architecture (5 Core Modules)

### Server Management
- `src/index.ts` - Main entry point and server initialization
- `src/modules/server-manager.ts` - Server lifecycle and request handling
- `src/modules/tool-definitions.ts` - MCP tool schema definitions (12 tools)
- `src/modules/tool-handlers.ts` - Tool implementation and request routing

### Core Functionality
- `src/modules/config-loader.ts` - Centralized configuration with caching
- `src/modules/object-index.ts` - High-performance object indexing
- `src/modules/file-utils.ts` - Secure file system operations
- `src/modules/parsers.ts` - X++ code analysis and parsing
- `src/modules/search.ts` - Multi-strategy search implementation

### Supporting Systems
- `src/modules/logger.ts` - Request/response logging with JSON serialization
- `src/modules/object-creators.ts` - D365 object generation templates
- `src/modules/aot-structure.ts` - AOT structure management
- `src/modules/app-config.ts` - Application configuration
- `src/modules/cache.ts` - Performance optimization

## Configuration System

### JSON Configuration Files
- `config/d365-aot-structure.json` - AOT object type definitions and structure
- `config/d365-model-config.json` - D365 model templates and metadata
- `config/d365-object-templates.json` - Object creation templates

### Environment Variables
- `XPP_CODEBASE_PATH` - Primary D365 codebase path
- `XPP_METADATA_FOLDER` - Custom metadata directory
- `WRITABLE_METADATA_PATH` - Output path for generated objects

## Build and Test Structure

### Directory Structure
- `build/` - Compiled TypeScript output with source maps
- `tests/` - Vitest test suite (23 tests)
  - `integration-real.test.js` - Real D365 integration tests (6 tests)
  - `test-config.js` - Centralized test configuration
- `cache/` - Runtime index cache files

### Development Commands
- `npm run build`: Build the TypeScript project to JavaScript
- `npm start`: Run the compiled MCP server
- `npm test`: Run comprehensive test suite (23 tests including real D365 integration)
- `npm run test:watch`: Run tests in watch mode for development
- `npm run test:ui`: Open Vitest web interface for interactive testing

## Testing Architecture

The project includes comprehensive testing with both mock and real integration tests:

### Mock Unit Tests (17 tests)
- JSON response format validation
- Tool logic testing with controlled data
- Parser functionality with simulated X++ content
- Error handling and security validation
- Performance testing with mock scenarios

### Real Integration Tests (6 tests)
- **NO MOCKS** - Uses actual D365 environment from `.vscode/mcp.json`
- Tests real 70K+ object indexing
- Validates JSON responses with actual D365 data (31K+ classes, 6K+ tables)
- Verifies configuration loading and path validation
- Tests real directory structure (169 D365 packages)
- Validates JSON serialization with Windows paths and special characters

### Test Results
- ✅ All 23 tests passing
- ⚡ Fast execution: Mock tests <1s, Integration tests ~600ms
- 🔍 Real D365 data: Tests against actual PackagesLocalDirectory
- 📊 Comprehensive coverage: From unit logic to end-to-end integration

## Security Features

- **Path Traversal Prevention**: Comprehensive validation against `../../../etc/passwd` attacks
- **File Size Limits**: Maximum 500KB per file with graceful handling
- **Result Limits**: Configurable pagination with totalCount metadata
- **JSON Injection Protection**: Safe serialization of Windows paths and special characters
- **Environment Isolation**: All operations restricted to configured D365 codebase path

## Performance Metrics

Real-world performance with actual D365 environment:
- **Index Loading**: 72,708 objects loaded in ~500ms
- **Object Queries**: Response time <50ms for filtered results
- **JSON Serialization**: 2,300+ character responses with complex data structures
- **Directory Scanning**: 169 D365 packages discovered and validated
- **Memory Efficiency**: Handles 31K+ classes and 6K+ tables with stable memory usage

## File System Architecture

### Project Structure
```
mcp_xpp/
├── src/
│   ├── index.ts                    # Main entry point
│   └── modules/                    # Core modules
│       ├── server-manager.ts       # MCP server lifecycle
│       ├── tool-definitions.ts     # Tool schemas
│       ├── tool-handlers.ts        # Tool implementations
│       ├── config-loader.ts        # Configuration management
│       ├── object-index.ts         # Object indexing
│       ├── file-utils.ts           # File operations
│       ├── parsers.ts              # X++ parsing
│       ├── search.ts               # Search functionality
│       ├── logger.ts               # Logging system
│       ├── object-creators.ts      # Object templates
│       ├── aot-structure.ts        # AOT management
│       ├── app-config.ts           # App configuration
│       └── cache.ts                # Caching system
├── config/
│   ├── d365-aot-structure.json     # Object type definitions
│   ├── d365-model-config.json      # Model templates
│   └── d365-object-templates.json  # Creation templates
├── build/                          # Compiled output
├── tests/                          # Test suite
├── cache/                          # Runtime cache
└── docs/                           # Documentation
```

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **MCP Protocol**: @modelcontextprotocol/sdk
- **Database**: SQLite for object indexing
- **IPC**: Named Pipes for C# service communication
- **Testing**: Vitest with both mock and real integration tests
- **Build**: TypeScript compiler with source maps

## Dependencies

### Core Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `zod` - Schema validation
- `sqlite3` - Database operations
- `typescript` - Type system and compilation

### D365 Integration
- Custom C# service using Microsoft.Dynamics.AX.Metadata assemblies
- Named Pipes communication for VS2022 API access
- Direct integration with D365 F&O development tools

## Label Management Architecture

### Overview
The label management system provides efficient retrieval of D365 F&O label text with multi-language support. This feature enables AI assistants and developers to retrieve human-readable label text for entities, fields, and UI elements.

### C# Backend - LabelHandler
**File**: `ms-api-server/Handlers/LabelHandler.cs`

**Key Components**:
- **Extends**: `BaseRequestHandler` - Follows established handler pattern
- **Supported Action**: `labels`
- **Operations**: 
  - `get_label` - Single label retrieval
  - `get_labels_batch` - Batch label retrieval

**Implementation Details**:
```csharp
// Uses Microsoft.Dynamics.AX.Metadata.Service APIs
private IMetadataProvider _metadataProvider;

// Initialize with DiskBasedMetadataProvider
_metadataProvider = new DiskBasedMetadataProvider(metadataPath);

// Read label
var label = _metadataProvider.Labels.Read(labelId);
```

**Features**:
- Language fallback mechanism (requested language → English)
- Label ID format support (with/without @ prefix)
- Batch processing for efficiency
- Missing label handling
- Graceful error handling

### TypeScript Frontend - Tool Handlers
**File**: `src/modules/tool-handlers.ts`

**Methods**:
- `static async getLabel(args, requestId)` - Single label handler
- `static async getLabelsBatch(args, requestId)` - Batch label handler

**Validation**:
```typescript
// Zod schema validation
const schema = z.object({
  labelId: z.string().min(1, "labelId is required"),
  language: z.string().optional().default("en-US"),
});
```

**Communication**:
- Dynamic import of D365ServiceClient
- Named Pipe IPC to C# service
- Request/response through `sendRequest()` method
- Timeout: 30 seconds for label operations

### Tool Definitions
**File**: `src/modules/tool-definitions.ts`

**Tools**:
1. **get_label**
   - Parameters: `labelId` (required), `language` (optional)
   - Examples: Single label retrieval in different languages
   - Default language: en-US

2. **get_labels_batch**
   - Parameters: `labelIds[]` (required), `language` (optional)
   - Examples: Multiple label retrieval
   - Returns: Success rate, found/missing label counts

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│           MCP Client (Claude, VS Code)              │
└───────────────────┬─────────────────────────────────┘
                    │ MCP Protocol (STDIO)
                    │
┌───────────────────▼─────────────────────────────────┐
│       TypeScript MCP Server (Node.js)               │
│  ┌──────────────────────────────────────────────┐   │
│  │ server-manager.ts                            │   │
│  │  • Routes "get_label" and                    │   │
│  │    "get_labels_batch" calls                  │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │ tool-handlers.ts                             │   │
│  │  • getLabel() - Validates labelId/language   │   │
│  │  • getLabelsBatch() - Validates labelIds[]   │   │
│  │  • Formats response output                   │   │
│  └──────────────┬───────────────────────────────┘   │
└─────────────────┼───────────────────────────────────┘
                  │ Named Pipe IPC
                  │ (action: "labels")
┌─────────────────▼───────────────────────────────────┐
│     C# D365 Metadata Service (.NET 4.8)             │
│  ┌──────────────────────────────────────────────┐   │
│  │ RequestHandlerFactory                        │   │
│  │  → Routes to LabelHandler                    │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │ LabelHandler                                 │   │
│  │  • HandleGetLabelAsync()                     │   │
│  │  • HandleGetLabelsBatchAsync()               │   │
│  │  • GetLabelText() with fallback              │   │
│  └──────────────┬───────────────────────────────┘   │
│  ┌──────────────▼───────────────────────────────┐   │
│  │ IMetadataProvider (DiskBasedMetadataProvider)│   │
│  │  • Labels.Read(labelId)                      │   │
│  │  • Language-specific label retrieval         │   │
│  └──────────────┬───────────────────────────────┘   │
└─────────────────┼───────────────────────────────────┘
                  │
                  ▼
          [D365 Label Metadata Files]
```

### Response Formats

**Single Label (get_label)**:
```json
{
  "labelId": "@SYS13342",
  "language": "en-US",
  "labelText": "Company",
  "found": true
}
```

**Batch Labels (get_labels_batch)**:
```json
{
  "language": "en-US",
  "totalRequested": 3,
  "totalFound": 3,
  "labels": {
    "@SYS13342": "Company",
    "@SYS9490": "Customer",
    "@GLS63332": "General ledger"
  },
  "missingLabels": []
}
```

### Performance Characteristics

- **Single Label**: ~100-300ms per request
- **Batch Labels**: ~200-500ms for 10-50 labels
- **Efficiency Gain**: Batch operations are ~60% faster than individual calls
- **Caching**: Not implemented (optional future enhancement)
- **Concurrency**: Sequential processing within batch

### Error Handling

**TypeScript Layer**:
- Zod validation for input parameters
- McpError for protocol-compliant errors
- Graceful error message formatting

**C# Layer**:
- Try/catch with detailed error logging
- Missing label indication (not errors)
- Language fallback mechanism
- Metadata provider initialization errors

### Testing

**Test File**: `tests/labels.test.js`

**Coverage**:
- Tool discovery and registration (2 tests)
- Single label retrieval (4 tests)
- Batch label retrieval (3 tests)
- Multi-language support (2 tests)
- Error handling & edge cases (4 tests)
- Performance tests (2 tests)

**Total**: 17 dedicated label management tests

### Use Cases

1. **Display User-Friendly Names**: Retrieve label text for entities and fields
2. **Build Multi-Language Interfaces**: Support internationalization
3. **Create Documentation**: Use proper D365 terminology
4. **Validate Label Usage**: Check if labels exist before using in code
5. **Label Translation**: Compare labels across different languages

### Future Enhancements

**Potential Improvements**:
- SQLite-based label caching with TTL
- Pre-warming cache for common system labels
- Label search functionality (find labels by text)
- Label creation/modification support
- Label validation and duplicate detection

---

**Note**: This document reflects the current implementation as of January 2026. For high-level architecture and user guides, see the main README.md file.
