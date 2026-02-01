using D365MetadataService.Models;
using D365MetadataService.Services;
using Microsoft.Dynamics.AX.Metadata.MetaModel;
using Microsoft.Dynamics.AX.Metadata.Providers;
using Microsoft.Dynamics.AX.Metadata.Service;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace D365MetadataService.Handlers
{
    /// <summary>
    /// Handler for label retrieval operations
    /// Supports single label and batch label retrieval with language support
    /// </summary>
    public class LabelHandler : BaseRequestHandler
    {
        private readonly ServiceConfiguration _config;
        private IMetadataProvider _metadataProvider;

        public LabelHandler(ServiceConfiguration config, ILogger logger) 
            : base(logger)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        public override string SupportedAction => "labels";

        protected override async Task<ServiceResponse> HandleRequestAsync(ServiceRequest request)
        {
            var validationError = ValidateRequest(request);
            if (validationError != null)
                return validationError;

            Logger.Information("Handling Label request: {@Request}", new { request.Action, request.Id });

            try
            {
                // Initialize metadata provider if not already done
                if (_metadataProvider == null)
                {
                    _metadataProvider = InitializeMetadataProvider();
                }

                // Extract operation type
                var operation = request.Parameters?.ContainsKey("operation") == true 
                    ? request.Parameters["operation"]?.ToString() 
                    : "get_label";

                switch (operation?.ToLower())
                {
                    case "get_label":
                        return await HandleGetLabelAsync(request);
                    
                    case "get_labels_batch":
                        return await HandleGetLabelsBatchAsync(request);
                    
                    default:
                        return ServiceResponse.CreateError($"Unsupported label operation: {operation}");
                }
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Error handling label request");
                return ServiceResponse.CreateError($"Failed to process label request: {ex.Message}");
            }
        }

        private async Task<ServiceResponse> HandleGetLabelAsync(ServiceRequest request)
        {
            try
            {
                var labelId = request.Parameters?.ContainsKey("labelId") == true 
                    ? request.Parameters["labelId"]?.ToString() 
                    : null;
                
                var language = request.Parameters?.ContainsKey("language") == true 
                    ? request.Parameters["language"]?.ToString() 
                    : "en-US";

                if (string.IsNullOrEmpty(labelId))
                {
                    return ServiceResponse.CreateError("labelId parameter is required");
                }

                Logger.Information("Getting label: {LabelId}, Language: {Language}", labelId, language);

                var labelText = await Task.Run(() => GetLabelText(labelId, language));
                var found = !string.IsNullOrEmpty(labelText);

                var result = new Dictionary<string, object>
                {
                    ["labelId"] = labelId,
                    ["language"] = language,
                    ["labelText"] = labelText ?? string.Empty,
                    ["found"] = found
                };

                Logger.Information("Label retrieval {Status}: {LabelId}", found ? "succeeded" : "not found", labelId);

                return ServiceResponse.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Error getting label");
                return ServiceResponse.CreateError($"Failed to get label: {ex.Message}");
            }
        }

        private async Task<ServiceResponse> HandleGetLabelsBatchAsync(ServiceRequest request)
        {
            try
            {
                var labelIdsParam = request.Parameters?.ContainsKey("labelIds") == true 
                    ? request.Parameters["labelIds"] 
                    : null;
                
                var language = request.Parameters?.ContainsKey("language") == true 
                    ? request.Parameters["language"]?.ToString() 
                    : "en-US";

                if (labelIdsParam == null)
                {
                    return ServiceResponse.CreateError("labelIds parameter is required");
                }

                // Convert labelIds to string array
                List<string> labelIds = new List<string>();
                if (labelIdsParam is Newtonsoft.Json.Linq.JArray jArray)
                {
                    labelIds = jArray.ToObject<List<string>>();
                }
                else if (labelIdsParam is System.Collections.IEnumerable enumerable)
                {
                    foreach (var item in enumerable)
                    {
                        labelIds.Add(item?.ToString());
                    }
                }

                if (labelIds == null || labelIds.Count == 0)
                {
                    return ServiceResponse.CreateError("labelIds array cannot be empty");
                }

                Logger.Information("Getting batch of {Count} labels, Language: {Language}", labelIds.Count, language);

                var labels = new Dictionary<string, string>();
                var missingLabels = new List<string>();

                await Task.Run(() =>
                {
                    foreach (var labelId in labelIds)
                    {
                        if (string.IsNullOrEmpty(labelId))
                            continue;

                        var labelText = GetLabelText(labelId, language);
                        if (!string.IsNullOrEmpty(labelText))
                        {
                            labels[labelId] = labelText;
                        }
                        else
                        {
                            missingLabels.Add(labelId);
                        }
                    }
                });

                var result = new Dictionary<string, object>
                {
                    ["language"] = language,
                    ["totalRequested"] = labelIds.Count,
                    ["totalFound"] = labels.Count,
                    ["labels"] = labels,
                    ["missingLabels"] = missingLabels
                };

                Logger.Information("Batch label retrieval complete: {Found}/{Total} labels found", 
                    labels.Count, labelIds.Count);

                return ServiceResponse.CreateSuccess(result);
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Error getting labels batch");
                return ServiceResponse.CreateError($"Failed to get labels batch: {ex.Message}");
            }
        }

        private string GetLabelText(string labelId, string language)
        {
            try
            {
                if (string.IsNullOrEmpty(labelId))
                    return null;

                // Ensure label ID starts with @
                if (!labelId.StartsWith("@"))
                {
                    labelId = "@" + labelId;
                }

                // Parse label ID (format: @ModuleName:LabelId or @LabelId)
                string labelFile = null;
                string labelName = labelId;

                if (labelId.Contains(":"))
                {
                    var parts = labelId.Substring(1).Split(':');
                    if (parts.Length == 2)
                    {
                        labelFile = parts[0];
                        labelName = parts[1];
                    }
                }
                else
                {
                    // Extract label file from label ID (e.g., @SYS13342 -> SYS)
                    var match = System.Text.RegularExpressions.Regex.Match(labelId, @"@([A-Z]+)\d+");
                    if (match.Success)
                    {
                        labelFile = match.Groups[1].Value;
                    }
                }

                // Try to read the label using metadata provider
                if (_metadataProvider != null && _metadataProvider.Labels != null)
                {
                    try
                    {
                        // Try to get the label
                        var label = _metadataProvider.Labels.Read(labelId);
                        if (label != null)
                        {
                            // Try to get the text for the requested language
                            var labelText = GetLabelTextForLanguage(label, language);
                            if (!string.IsNullOrEmpty(labelText))
                            {
                                return labelText;
                            }

                            // Fallback to English if requested language not found
                            if (language != "en-US")
                            {
                                labelText = GetLabelTextForLanguage(label, "en-US");
                                if (!string.IsNullOrEmpty(labelText))
                                {
                                    Logger.Information("Label {LabelId} found in en-US (fallback from {Language})", 
                                        labelId, language);
                                    return labelText;
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Logger.Warning(ex, "Error reading label {LabelId} from metadata provider", labelId);
                    }
                }

                Logger.Debug("Label {LabelId} not found for language {Language}", labelId, language);
                return null;
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Error getting label text for {LabelId}", labelId);
                return null;
            }
        }

        private string GetLabelTextForLanguage(AxLabelFile label, string language)
        {
            try
            {
                if (label == null)
                    return null;

                // Try to get the label text for the specified language
                // The AxLabelFile object has a Language property that contains the labels
                // We need to use reflection to access the labels for a specific language
                
                // Note: The actual implementation may vary depending on the D365 metadata API version
                // This is a simplified approach that tries to get the label text
                
                // Try to get the label text directly
                var labelProperty = label.GetType().GetProperty("LabelText");
                if (labelProperty != null)
                {
                    var labelText = labelProperty.GetValue(label) as string;
                    if (!string.IsNullOrEmpty(labelText))
                    {
                        return labelText;
                    }
                }

                // Alternative: Try to access label content through Labels property
                var labelsProperty = label.GetType().GetProperty("Labels");
                if (labelsProperty != null)
                {
                    var labels = labelsProperty.GetValue(label);
                    if (labels != null)
                    {
                        // Try to find the label for the specified language
                        // This may require further implementation based on the actual structure
                        return labels.ToString();
                    }
                }

                return null;
            }
            catch (Exception ex)
            {
                Logger.Warning(ex, "Error getting label text for language {Language}", language);
                return null;
            }
        }

        private IMetadataProvider InitializeMetadataProvider()
        {
            try
            {
                Logger.Information("Initializing metadata provider for label access");

                // Get the metadata path from FileSystemManager
                var metadataPath = FileSystemManager.Instance.GetPackagesLocalDirectory();
                
                if (string.IsNullOrEmpty(metadataPath))
                {
                    Logger.Warning("Metadata path not configured, label access may be limited");
                    return null;
                }

                Logger.Information("Using metadata path: {MetadataPath}", metadataPath);

                // Create metadata provider using the disk provider
                var provider = new DiskBasedMetadataProvider(metadataPath);
                
                Logger.Information("Metadata provider initialized successfully");
                
                return provider;
            }
            catch (Exception ex)
            {
                Logger.Error(ex, "Failed to initialize metadata provider for labels");
                return null;
            }
        }
    }
}
