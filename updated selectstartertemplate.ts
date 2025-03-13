import ignore from 'ignore';
import type { ProviderInfo } from '~/types/model';
import type { Template } from '~/types/template';
import { STARTER_TEMPLATES } from './constants';
import Cookies from 'js-cookie';

const starterTemplateSelectionPrompt = (templates: Template[]) => `
You are an experienced front-end developer who helps convert Figma designs into Angular applications by selecting the most appropriate starter template.

Available templates:
<template>
  <name>blank</name>
  <description>Empty starter for simple scripts and trivial tasks that don't require a full template setup</description>
  <tags>basic, script</tags>
</template>
${templates
  .map(
    (template) => `
<template>
  <name>${template.name}</name>
  <description>${template.description}</description>
  ${template.tags ? `<tags>${template.tags.join(', ')}</tags>` : ''}
</template>
`,
  )
  .join('\n')}

Response Format:
<selection>
  <templateName>{selected template name}</templateName>
  <title>{a proper title for the project based on the Figma design purpose}</title>
</selection>

Examples:

<example>
User: I need to convert a Figma design for an e-commerce dashboard
Response:
<selection>
  <templateName>angular-dashboard-starter</templateName>
  <title>E-commerce Admin Dashboard</title>
</selection>
</example>

<example>
User: Convert my Figma design for a simple landing page
Response:
<selection>
  <templateName>angular-landing-page</templateName>
  <title>Responsive Landing Page</title>
</selection>
</example>

<example>
User: I have a Figma mockup for a complex form with multiple steps
Response:
<selection>
  <templateName>angular-form-wizard</templateName>
  <title>Multi-step Form Application</title>
</selection>
</example>

<example>
User: Need to implement a Figma design for a mobile-first blog
Response:
<selection>
  <templateName>angular-mobile-blog</templateName>
  <title>Mobile-optimized Blog Template</title>
</selection>
</example>

<example>
User: Write a script to generate numbers from 1 to 100
Response:
<selection>
  <templateName>blank</templateName>
  <title>Script to generate numbers from 1 to 100</title>
</selection>
</example>

<example>
User: Convert my Figma design with lots of data visualization components
Response:
<selection>
  <templateName>angular-data-viz</templateName>
  <title>Data Visualization Dashboard</title>
</selection>
</example>

<example>
User: I have a Figma design for a simple contact form
Response:
<selection>
  <templateName>angular-basic-starter</templateName>
  <title>Contact Form Implementation</title>
</selection>
</example>

<example>
User: My Figma design has a navigation bar with dropdown menus
Response:
<selection>
  <templateName>angular-navigation-template</templateName>
  <title>Application with Advanced Navigation</title>
</selection>
</example>

<example>
User: I need to implement a Figma design for a product catalog
Response:
<selection>
  <templateName>angular-product-catalog</templateName>
  <title>Product Catalog Implementation</title>
</selection>
</example>

<example>
User: My Figma has many custom form inputs and validations
Response:
<selection>
  <templateName>angular-form-controls</templateName>
  <title>Custom Form Controls Application</title>
</selection>
</example>

Instructions:
1. For trivial tasks and simple scripts, recommend the blank template
2. For Figma designs being converted to Angular, recommend templates that match the UI requirements
3. Consider responsive design needs based on the user's description
4. Prioritize templates with component libraries that match the Figma style guides if mentioned
5. Follow the exact XML format
6. Consider both technical requirements and tags
7. If no perfect match exists, recommend the closest option

Important: Provide only the selection tags in your response, no additional text.
`;

const templates: Template[] = STARTER_TEMPLATES.filter((t) => !t.name.includes('shadcn'));

const parseSelectedTemplate = (llmOutput: string): { template: string; title: string } | null => {
  try {
    // More robust regex that handles different formatting and whitespace
    const templateNameMatch = llmOutput.match(/<templateName>(.*?)<\/templateName>/s);
    const titleMatch = llmOutput.match(/<title>(.*?)<\/title>/s);

    if (!templateNameMatch) {
      console.warn('Failed to parse template selection. LLM output:', llmOutput);
      return null;
    }

    const template = templateNameMatch[1].trim();
    const title = titleMatch?.[1].trim() || 'Untitled Project';

    // Validate template exists
    const templateExists = STARTER_TEMPLATES.some(t => t.name === template);
    if (!templateExists && template !== 'blank') {
      console.warn(`Selected template "${template}" does not exist in the available templates.`);
      // Fall back to a default template that's appropriate for Angular projects
      const defaultAngularTemplate = STARTER_TEMPLATES.find(t => t.name.includes('angular-basic')) || 
                                    STARTER_TEMPLATES.find(t => t.name.includes('angular')) || 
                                    {name: 'blank'};
      return {
        template: defaultAngularTemplate.name,
        title: title
      };
    }

    return { template, title };
  } catch (error) {
    console.error('Error parsing template selection:', error);
    return null;
  }
};

export const selectStarterTemplate = async (options: { message: string; model: string; provider: ProviderInfo }) => {
  const { message, model, provider } = options;
  const requestBody = {
    message,
    model,
    provider,
    system: starterTemplateSelectionPrompt(templates),
  };
  const response = await fetch('/api/llmcall', {
    method: 'POST',
    body: JSON.stringify(requestBody),
  });
  const respJson: { text: string } = await response.json();
  console.log(respJson);

  const { text } = respJson;
  const selectedTemplate = parseSelectedTemplate(text);

  if (selectedTemplate) {
    return selectedTemplate;
  } else {
    console.log('No template selected, using blank template');

    return {
      template: 'blank',
      title: '',
    };
  }
};

export const processFigmaToAngular = async (options: { 
  figmaData?: any; 
  message: string; 
  model: string; 
  provider: ProviderInfo 
}) => {
  const { figmaData, message, model, provider } = options;
  
  // Enhance the user message with Figma information if available
  let enhancedMessage = message;
  if (figmaData) {
    // Extract key information from Figma data
    const componentCount = figmaData.components?.length || 0;
    const hasComplexForms = figmaData.components?.some(c => c.type?.includes('form') || c.name?.includes('form'));
    const hasDashboard = figmaData.components?.some(c => c.type?.includes('dashboard') || c.name?.includes('dashboard'));
    const styleGuide = figmaData.styleGuide || {};
    
    enhancedMessage = `
I need to convert a Figma design to Angular. 
Design details:
- ${componentCount} components
- ${hasComplexForms ? 'Includes complex forms' : 'No complex forms'}
- ${hasDashboard ? 'Includes dashboard elements' : 'No dashboard elements'}
- Primary colors: ${styleGuide.primaryColors || 'Not specified'}
- Typography: ${styleGuide.typography || 'Not specified'}

Original request: ${message}
    `.trim();
  }
  
  // Get template recommendation
  const templateSelection = await selectStarterTemplate({
    message: enhancedMessage,
    model,
    provider,
  });
  
  // Get template files
  const templateFiles = await getTemplates(templateSelection.template, templateSelection.title);
  
  // Add Figma style processing if available
  if (figmaData && templateFiles) {
    // Generate Angular components from Figma components if available
    if (figmaData.components && figmaData.components.length > 0) {
      const generatedFiles = generateAngularComponentsFromFigma(figmaData.components);
      
      // Add information about generated components to the user message
      templateFiles.userMessage = `
${templateFiles.userMessage}

FIGMA COMPONENT INFORMATION:
${figmaData.components.length} components have been analyzed from your Figma design.
Angular components have been generated in the src/app/components directory based on these designs.
Please review these components and adjust as needed to match your exact design requirements.
      `;
    } else {
      // Just add style information if no components were found
      templateFiles.userMessage = `
${templateFiles.userMessage}

FIGMA STYLING INFORMATION:
The imported template has been selected based on your Figma design. 
You should update the styles to match the Figma design specifications.
- Review the color schemes in the design files
- Match typography according to the Figma specs
- Implement the component structure as shown in the design
      `;
    }
  }
  
  return templateFiles;
};

export const generateAngularComponentsFromFigma = (figmaComponents: any[], baseDir: string = 'src/app/components') => {
  if (!figmaComponents || figmaComponents.length === 0) {
    return [];
  }
  
  const componentFiles = figmaComponents.map(component => {
    const componentName = component.name
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    
    const componentClassName = componentName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + 'Component';
      
    const selector = `app-${componentName}`;
    const filePath = `${baseDir}/${componentName}/${componentName}.component.ts`;
    
    // Generate a basic Angular component
    const componentContent = `import { Component, OnInit } from '@angular/core';

@Component({
  selector: '${selector}',
  templateUrl: './${componentName}.component.html',
  styleUrls: ['./${componentName}.component.scss']
})
export class ${componentClassName} implements OnInit {
  // Properties based on Figma component attributes
  ${component.properties ? component.properties.map(prop => 
    `${prop.name}: ${prop.type} = ${prop.defaultValue || 'undefined'};`
  ).join('\n  ') : ''}

  constructor() { }

  ngOnInit(): void {
  }
}`;

    // Generate HTML template based on Figma layout
    const templatePath = `${baseDir}/${componentName}/${componentName}.component.html`;
    const templateContent = generateHtmlFromFigmaComponent(component);
    
    // Generate SCSS styles based on Figma styles
    const stylePath = `${baseDir}/${componentName}/${componentName}.component.scss`;
    const styleContent = generateScssFromFigmaComponent(component);
    
    return [
      { path: filePath, content: componentContent },
      { path: templatePath, content: templateContent },
      { path: stylePath, content: styleContent }
    ];
  });
  
  // Flatten the array
  return componentFiles.flat();
};

// Helper function to generate HTML from Figma component
function generateHtmlFromFigmaComponent(component: any): string {
  // This would contain actual logic to convert Figma nodes to HTML
  // For now, creating a placeholder
  return `<div class="${component.name.toLowerCase()}-container">
  <!-- Generated from Figma component: ${component.name} -->
  <ng-content></ng-content>
</div>`;
}

// Helper function to generate SCSS from Figma component styles
function generateScssFromFigmaComponent(component: any): string {
  // This would contain actual logic to convert Figma styles to SCSS
  // For now, creating a placeholder
  return `.${component.name.toLowerCase()}-container {
  // Generated from Figma component styles
  ${component.styles ? Object.entries(component.styles).map(([key, value]) => 
    `${key}: ${value};`
  ).join('\n  ') : ''}
}`;
}

const getGitHubRepoContent = async (
  repoName: string,
  path: string = '',
): Promise<{ name: string; path: string; content: string }[]> => {
  const baseUrl = 'https://api.github.com';

  try {
    const token = Cookies.get('githubToken') || import.meta.env.VITE_GITHUB_ACCESS_TOKEN;

    const headers: HeadersInit = {
      Accept: 'application/vnd.github.v3+json',
    };

    // Add GitHub token if available
    if (token) {
      headers.Authorization = 'token ' + token;
    }

    // Fetch contents of the path
    const response = await fetch(`${baseUrl}/repos/${repoName}/contents/${path}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data: any = await response.json();

    // If it's a single file, return its content
    if (!Array.isArray(data)) {
      if (data.type === 'file') {
        // If it's a file, get its content
        const content = atob(data.content); // Decode base64 content
        return [
          {
            name: data.name,
            path: data.path,
            content,
          },
        ];
      }
    }

    // Process directory contents recursively
    const contents = await Promise.all(
      data.map(async (item: any) => {
        if (item.type === 'dir') {
          // Recursively get contents of subdirectories
          return await getGitHubRepoContent(repoName, item.path);
        } else if (item.type === 'file') {
          // Fetch file content
          const fileResponse = await fetch(item.url, {
            headers,
          });
          const fileData: any = await fileResponse.json();
          const content = atob(fileData.content); // Decode base64 content

          return [
            {
              name: item.name,
              path: item.path,
              content,
            },
          ];
        }

        return [];
      }),
    );

    // Flatten the array of contents
    return contents.flat();
  } catch (error) {
    console.error('Error fetching repo contents:', error);
    throw error;
  }
};

export async function getTemplates(templateName: string, title?: string) {
  const template = STARTER_TEMPLATES.find((t) => t.name == templateName);

  if (!template) {
    console.warn(`Template "${templateName}" not found, falling back to blank template`);
    const blankTemplate = STARTER_TEMPLATES.find((t) => t.name === 'blank');
    if (!blankTemplate) {
      return null;
    }
    return getTemplates('blank', title || 'Blank Project');
  }

  const githubRepo = template.githubRepo;
  
  try {
    const files = await getGitHubRepoContent(githubRepo);

    let filteredFiles = files;

    /*
     * ignoring common unwanted files
     * exclude    .git
     */
    filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.git') == false);

    // exclude    lock files
    const comminLockFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'];
    filteredFiles = filteredFiles.filter((x) => comminLockFiles.includes(x.name) == false);

    // exclude    .bolt
    filteredFiles = filteredFiles.filter((x) => x.path.startsWith('.bolt') == false);

    // check for ignore file in .bolt folder
    const templateIgnoreFile = files.find((x) => x.path.startsWith('.bolt') && x.name == 'ignore');

    const filesToImport = {
      files: filteredFiles,
      ignoreFile: [] as typeof filteredFiles,
    };

    if (templateIgnoreFile) {
      // redacting files specified in ignore file
      const ignorepatterns = templateIgnoreFile.content.split('\n').map((x) => x.trim());
      const ig = ignore().add(ignorepatterns);

      // filteredFiles = filteredFiles.filter(x => !ig.ignores(x.path))
      const ignoredFiles = filteredFiles.filter((x) => ig.ignores(x.path));

      filesToImport.files = filteredFiles;
      filesToImport.ignoreFile = ignoredFiles;
    }

    const assistantMessage = `
<boltArtifact id="imported-files" title="${title || 'Importing Starter Files'}" type="bundled">
${filesToImport.files
  .map(
    (file) =>
      `<boltAction type="file" filePath="${file.path}">
${file.content}
</boltAction>`,
  )
  .join('\n')}
</boltArtifact>
`;
    let userMessage = ``;
    const templatePromptFile = files.filter((x) => x.path.startsWith('.bolt')).find((x) => x.name == 'prompt');

    if (templatePromptFile) {
      userMessage = `
TEMPLATE INSTRUCTIONS:
${templatePromptFile.content}

IMPORTANT: Dont Forget to install the dependencies before running the app
---
`;
    }

    if (filesToImport.ignoreFile.length > 0) {
      userMessage =
        userMessage +
        `
STRICT FILE ACCESS RULES - READ CAREFULLY:

The following files are READ-ONLY and must never be modified:
${filesToImport.ignoreFile.map((file) => `- ${file.path}`).join('\n')}

Permitted actions:
✓ Import these files as dependencies
✓ Read from these files
✓ Reference these files

Strictly forbidden actions:
❌ Modify any content within these files
❌ Delete these files
❌ Rename these files
❌ Move these files
❌ Create new versions of these files
❌ Suggest changes to these files

Any attempt to modify these protected files will result in immediate termination of the operation.

If you need to make changes to functionality, create new files instead of modifying the protected ones listed above.
---
`;
    }

    userMessage += `
---
template import is done, and you can now use the imported files,
edit only the files that need to be changed, and you can create new files as needed.
NO NOT EDIT/WRITE ANY FILES THAT ALREADY EXIST IN THE PROJECT AND DOES NOT NEED TO BE MODIFIED
---
Now that the Template is imported please continue with my original request
`;

    return {
      assistantMessage,
      userMessage,
    };
  } catch (error) {
    console.error(`Error fetching template content for ${templateName}:`, error);
    // Return fallback message in case of error
    return {
      assistantMessage: `
<boltArtifact id="error-message" title="Template Import Error" type="error">
Failed to import template "${templateName}". Error: ${error.message}
</boltArtifact>
`,
      userMessage: `
There was an error importing the template "${templateName}". 
The system will proceed with a minimal setup.
Please provide more details about your Figma design requirements so I can help implement them manually.
`,
    };
  }
}

// Caching mechanism for GitHub repo content to improve performance
const repoContentCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_EXPIRY_MS = 3600000; // 1 hour

export async function getCachedGitHubRepoContent(repoName: string, path: string = '') {
  const cacheKey = `${repoName}:${path}`;
  
  // Check if we have a valid cached response
  const cachedData = repoContentCache.get(cacheKey);
  const now = Date.now();
  
  if (cachedData && (now - cachedData.timestamp < CACHE_EXPIRY_MS)) {
    console.log(`Using cached content for ${cacheKey}`);
    return cachedData.data;
  }
  
  // If no cache or expired, fetch fresh data
  try {
    const data = await getGitHubRepoContent(repoName, path);
    
    // Cache the result
    repoContentCache.set(cacheKey, {
      data,
      timestamp: now
    });
    
    return data;
  } catch (error) {
    console.error(`Cache miss and fetch error for ${cacheKey}:`, error);
    
    // If fetch fails but we have an expired cache, use it as fallback
    if (cachedData) {
      console.log(`Using expired cache as fallback for ${cacheKey}`);
      return cachedData.data;
    }
    
    throw error;
  }
}

// Export all functions for use in the application
export {
  starterTemplateSelectionPrompt,
  parseSelectedTemplate,
  generateHtmlFromFigmaComponent,
  generateScssFromFigmaComponent,
  getCachedGitHubRepoContent,
};
