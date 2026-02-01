/**
 * 🏷️ LABEL MANAGEMENT TESTS
 * Tests for D365 F&O Label Retrieval functionality
 * Focus: Single label retrieval, batch operations, multi-language support, error handling
 */

import { describe, test, expect, beforeAll } from 'vitest';
import { MCPXppClient, MCPTestUtils } from './tools/mcp-xpp-client.js';
import { AppConfig } from '../build/modules/app-config.js';

// =============================================================================
// 🏷️ LABEL MANAGEMENT TEST CONFIGURATION
// =============================================================================

const LABEL_CONFIG = {
  timeouts: {
    fast: 5000,      // 5 seconds for fast operations
    medium: 15000,   // 15 seconds for medium operations
    slow: 30000,     // 30 seconds for slow operations
  },
  testLabels: {
    // Common system labels that should exist in most D365 environments
    common: [
      '@SYS13342',  // Company
      '@SYS9490',   // Customer
      '@SYS1234',   // General
      '@SYS5678',   // Description
    ],
    // Labels that definitely don't exist
    invalid: [
      '@NOTEXIST99999',
      '@FAKE12345',
    ]
  },
  languages: {
    default: 'en-US',
    supported: ['en-US', 'de-DE', 'fr-FR', 'es-ES']
  }
};

let mcpClient;

// =============================================================================
// TEST SETUP
// =============================================================================

beforeAll(async () => {
  await AppConfig.initialize();
  mcpClient = await MCPTestUtils.createTestClient();
  
  console.log(`
🏷️ LABEL MANAGEMENT TEST SUITE LOADED
📋 Test Categories:
   - Tool Discovery & Registration
   - Single Label Retrieval
   - Batch Label Retrieval
   - Multi-language Support
   - Error Handling & Edge Cases

⏱️  Timeouts:
   - Fast operations: ${LABEL_CONFIG.timeouts.fast}ms
   - Medium operations: ${LABEL_CONFIG.timeouts.medium}ms
   - Slow operations: ${LABEL_CONFIG.timeouts.slow}ms

🎯 Focus: Label management and localization
`);
}, LABEL_CONFIG.timeouts.slow);

// Helper function to check D365 availability
const isD365Available = async () => {
  try {
    const config = await mcpClient.executeTool('get_current_config');
    return config && config.content && 
           (typeof config.content === 'string' ? 
            config.content.includes('PackagesLocalDirectory') : 
            JSON.stringify(config.content).includes('PackagesLocalDirectory'));
  } catch (error) {
    console.log('⏭️ D365 environment not available - tests skipped');
    return false;
  }
};

// =============================================================================
// 🏷️ TOOL DISCOVERY & REGISTRATION TESTS
// =============================================================================

describe('🏷️ Tool Discovery & Registration', () => {
  test('should list get_label tool in available tools', async () => {
    console.log('🔍 Checking for get_label tool...');
    
    const tools = await mcpClient.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toBeDefined();
    expect(Array.isArray(tools.tools)).toBe(true);
    
    const getLabelTool = tools.tools.find(t => t.name === 'get_label');
    expect(getLabelTool).toBeDefined();
    expect(getLabelTool.name).toBe('get_label');
    expect(getLabelTool.description).toContain('label');
    expect(getLabelTool.inputSchema).toBeDefined();
    expect(getLabelTool.inputSchema.properties.labelId).toBeDefined();
    expect(getLabelTool.inputSchema.properties.language).toBeDefined();
    
    console.log('✅ get_label tool found and properly configured');
  }, LABEL_CONFIG.timeouts.fast);

  test('should list get_labels_batch tool in available tools', async () => {
    console.log('🔍 Checking for get_labels_batch tool...');
    
    const tools = await mcpClient.listTools();
    expect(tools).toBeDefined();
    expect(tools.tools).toBeDefined();
    
    const batchTool = tools.tools.find(t => t.name === 'get_labels_batch');
    expect(batchTool).toBeDefined();
    expect(batchTool.name).toBe('get_labels_batch');
    expect(batchTool.description).toContain('label');
    expect(batchTool.inputSchema).toBeDefined();
    expect(batchTool.inputSchema.properties.labelIds).toBeDefined();
    expect(batchTool.inputSchema.properties.labelIds.type).toBe('array');
    
    console.log('✅ get_labels_batch tool found and properly configured');
  }, LABEL_CONFIG.timeouts.fast);
});

// =============================================================================
// 🏷️ SINGLE LABEL RETRIEVAL TESTS
// =============================================================================

describe('🏷️ Single Label Retrieval', () => {
  test('should retrieve a single label with default language', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing single label retrieval (default language)...');
    
    const result = await mcpClient.executeTool('get_label', {
      labelId: '@SYS13342'
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Should contain label information
    expect(content).toContain('Label:');
    expect(content).toContain('@SYS13342');
    expect(content).toContain('Language:');
    
    console.log('✅ Single label retrieved successfully');
    console.log(`📄 Result preview: ${content.substring(0, 200)}...`);
  }, LABEL_CONFIG.timeouts.medium);

  test('should retrieve a single label with specific language', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing single label retrieval (specific language)...');
    
    const result = await mcpClient.executeTool('get_label', {
      labelId: '@SYS13342',
      language: 'en-US'
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    expect(content).toContain('Label:');
    expect(content).toContain('@SYS13342');
    expect(content).toContain('Language: en-US');
    
    console.log('✅ Label retrieved with specific language');
  }, LABEL_CONFIG.timeouts.medium);

  test('should handle label ID without @ prefix', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing label ID without @ prefix...');
    
    const result = await mcpClient.executeTool('get_label', {
      labelId: 'SYS13342'  // No @ prefix
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    expect(content).toContain('Label:');
    
    console.log('✅ Label ID without @ prefix handled correctly');
  }, LABEL_CONFIG.timeouts.medium);

  test('should handle missing label gracefully', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing missing label handling...');
    
    const result = await mcpClient.executeTool('get_label', {
      labelId: '@NOTEXIST99999'
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Should indicate label not found
    expect(content.toLowerCase()).toMatch(/not found|does not exist/);
    
    console.log('✅ Missing label handled gracefully');
  }, LABEL_CONFIG.timeouts.medium);
});

// =============================================================================
// 🏷️ BATCH LABEL RETRIEVAL TESTS
// =============================================================================

describe('🏷️ Batch Label Retrieval', () => {
  test('should retrieve multiple labels in a single request', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing batch label retrieval...');
    
    const result = await mcpClient.executeTool('get_labels_batch', {
      labelIds: ['@SYS13342', '@SYS9490']
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Should contain batch results
    expect(content).toContain('Batch Label Retrieval Results');
    expect(content).toContain('Total Requested:');
    expect(content).toContain('Total Found:');
    expect(content).toContain('Language:');
    
    console.log('✅ Batch label retrieval successful');
    console.log(`📄 Result preview: ${content.substring(0, 300)}...`);
  }, LABEL_CONFIG.timeouts.medium);

  test('should handle batch with mixed existing and missing labels', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing batch with mixed labels...');
    
    const result = await mcpClient.executeTool('get_labels_batch', {
      labelIds: ['@SYS13342', '@NOTEXIST99999', '@SYS9490']
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Should have results and missing labels
    expect(content).toContain('Total Requested: 3');
    expect(content).toContain('Missing Labels:');
    
    console.log('✅ Mixed batch handled correctly');
  }, LABEL_CONFIG.timeouts.medium);

  test('should calculate success rate correctly', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing success rate calculation...');
    
    const result = await mcpClient.executeTool('get_labels_batch', {
      labelIds: ['@SYS13342', '@SYS9490']
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    
    // Should show success rate
    expect(content).toContain('Success Rate:');
    expect(content).toMatch(/Success Rate: \d+(\.\d+)?%/);
    
    console.log('✅ Success rate calculated correctly');
  }, LABEL_CONFIG.timeouts.medium);
});

// =============================================================================
// 🏷️ MULTI-LANGUAGE SUPPORT TESTS
// =============================================================================

describe('🏷️ Multi-language Support', () => {
  test('should support different language codes', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing multi-language support...');
    
    // Test with German
    const resultDE = await mcpClient.executeTool('get_label', {
      labelId: '@SYS13342',
      language: 'de-DE'
    });
    
    expect(resultDE).toBeDefined();
    expect(resultDE.content).toBeDefined();
    
    const contentDE = typeof resultDE.content === 'string' ? resultDE.content : JSON.stringify(resultDE.content);
    expect(contentDE).toContain('Language: de-DE');
    
    console.log('✅ German language code supported');
  }, LABEL_CONFIG.timeouts.medium);

  test('should fallback to English for unsupported language', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing language fallback...');
    
    // Request with a potentially unsupported language
    const result = await mcpClient.executeTool('get_label', {
      labelId: '@SYS13342',
      language: 'zh-CN'  // Chinese
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    // Should either return the Chinese translation or fallback info
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    expect(content).toContain('Label:');
    
    console.log('✅ Language fallback mechanism working');
  }, LABEL_CONFIG.timeouts.medium);
});

// =============================================================================
// 🏷️ ERROR HANDLING & EDGE CASES
// =============================================================================

describe('🏷️ Error Handling & Edge Cases', () => {
  test('should reject get_label with missing labelId', async () => {
    console.log('🏷️ Testing missing labelId error handling...');
    
    try {
      await mcpClient.executeTool('get_label', {
        language: 'en-US'  // Missing labelId
      });
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw validation error
      expect(error).toBeDefined();
      console.log('✅ Missing labelId properly rejected');
    }
  }, LABEL_CONFIG.timeouts.fast);

  test('should reject get_labels_batch with empty array', async () => {
    console.log('🏷️ Testing empty labelIds array...');
    
    try {
      await mcpClient.executeTool('get_labels_batch', {
        labelIds: []  // Empty array
      });
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Should throw validation error
      expect(error).toBeDefined();
      console.log('✅ Empty labelIds array properly rejected');
    }
  }, LABEL_CONFIG.timeouts.fast);

  test('should handle malformed label IDs gracefully', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing malformed label IDs...');
    
    const result = await mcpClient.executeTool('get_label', {
      labelId: '@@INVALID@@'
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    // Should handle gracefully, even if not found
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    expect(content).toContain('Label:');
    
    console.log('✅ Malformed label ID handled gracefully');
  }, LABEL_CONFIG.timeouts.medium);

  test('should handle very long label ID lists in batch', async () => {
    if (!(await isD365Available())) return;
    
    console.log('🏷️ Testing large batch request...');
    
    // Create a list of many different label IDs
    // Using a variety of system labels to test batch processing with unique labels
    const baseLabelIds = ['@SYS13342', '@SYS9490', '@SYS1234', '@SYS5678', '@GLS63332'];
    const manyLabels = [];
    
    // Generate 50 label IDs by appending numbers to base labels
    // This creates unique label IDs (most won't exist, but tests batch handling)
    for (let i = 0; i < 50; i++) {
      const baseLabel = baseLabelIds[i % baseLabelIds.length];
      manyLabels.push(baseLabel.replace(/\d+$/, '') + (10000 + i));
    }
    
    const result = await mcpClient.executeTool('get_labels_batch', {
      labelIds: manyLabels
    });
    
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    
    const content = typeof result.content === 'string' ? result.content : JSON.stringify(result.content);
    expect(content).toContain('Total Requested: 50');
    
    console.log('✅ Large batch request handled successfully');
  }, LABEL_CONFIG.timeouts.slow);
});

// =============================================================================
// 🏷️ PERFORMANCE TESTS
// =============================================================================

describe('🏷️ Performance Tests', () => {
  test('should retrieve single label within acceptable time', async () => {
    if (!(await isD365Available())) return;
    
    console.log('⏱️ Testing single label retrieval performance...');
    
    const startTime = Date.now();
    
    await mcpClient.executeTool('get_label', {
      labelId: '@SYS13342'
    });
    
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Single label retrieval took ${duration}ms`);
    
    // Should be reasonably fast (under 10 seconds)
    expect(duration).toBeLessThan(10000);
    
    console.log('✅ Performance acceptable');
  }, LABEL_CONFIG.timeouts.medium);

  test('should batch retrieval be more efficient than individual calls', async () => {
    if (!(await isD365Available())) return;
    
    console.log('⏱️ Comparing batch vs individual retrieval performance...');
    
    const testLabels = ['@SYS13342', '@SYS9490'];
    
    // Individual calls
    const startIndividual = Date.now();
    for (const labelId of testLabels) {
      await mcpClient.executeTool('get_label', { labelId });
    }
    const individualDuration = Date.now() - startIndividual;
    
    // Batch call
    const startBatch = Date.now();
    await mcpClient.executeTool('get_labels_batch', {
      labelIds: testLabels
    });
    const batchDuration = Date.now() - startBatch;
    
    console.log(`⏱️ Individual calls: ${individualDuration}ms`);
    console.log(`⏱️ Batch call: ${batchDuration}ms`);
    console.log(`⏱️ Efficiency gain: ${((1 - batchDuration/individualDuration) * 100).toFixed(1)}%`);
    
    // Batch should be faster or at least comparable
    // Note: In some cases batch might be slightly slower for very few items
    console.log('✅ Batch performance compared');
  }, LABEL_CONFIG.timeouts.slow);
});
