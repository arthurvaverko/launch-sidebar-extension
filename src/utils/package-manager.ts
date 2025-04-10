import * as fs from 'fs';
import * as path from 'path';

/**
 * Package manager types supported by the extension
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm';

/**
 * Detects the appropriate package manager for a given package.json file
 * Uses the following detection strategy:
 * 1. Check if package.json has an explicit "packageManager" field
 * 2. Check for lock files in the directory (yarn.lock, pnpm-lock.yaml, package-lock.json)
 * 3. Fall back to npm as the default
 *
 * @param packageJsonPath Path to the package.json file
 * @param rootLockfileManager Optional package manager determined from root lockfile
 * @returns The detected package manager ('npm', 'yarn', or 'pnpm')
 */
export function detectPackageManager(packageJsonPath: string, rootLockfileManager?: PackageManager): PackageManager {
  // Get the directory containing the package.json
  const packageDir = path.dirname(packageJsonPath);
  
  try {
    // If we have a root lockfile manager and this isn't the root package.json,
    // use the root manager for consistency
    const workspaceRoot = path.resolve(packageDir, '../..');
    const isRootPackage = path.relative(workspaceRoot, packageDir) === '';
    
    if (rootLockfileManager && !isRootPackage) {
      return rootLockfileManager;
    }
    
    // Strategy 1: Check package.json for explicit packageManager field
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check for explicit packageManager field (npm 7.x+)
        // Format could be "packageManager": "pnpm@7.1.0"
        if (packageJson.packageManager) {
          const pm = packageJson.packageManager.toLowerCase();
          if (pm.startsWith('pnpm@')) {
            return 'pnpm';
          } else if (pm.startsWith('yarn@')) {
            return 'yarn';
          } else if (pm.startsWith('npm@')) {
            return 'npm';
          }
        }
        
        // Some projects specify preferred package manager in engines or scripts
        if (packageJson.engines && packageJson.engines.npm) {
          return 'npm';
        } else if (packageJson.engines && packageJson.engines.yarn) {
          return 'yarn';
        } else if (packageJson.engines && packageJson.engines.pnpm) {
          return 'pnpm';
        }
        
        // Look for package manager references in scripts (common pattern)
        if (packageJson.scripts) {
          const scriptValues = Object.values(packageJson.scripts as Record<string, string>).join(' ');
          if (scriptValues.includes('pnpm ') && !scriptValues.includes('npm ')) {
            return 'pnpm';
          } else if (scriptValues.includes('yarn ') && !scriptValues.includes('npm ')) {
            return 'yarn';
          }
        }
      } catch (err) {
        // If we can't parse package.json, continue to next detection method
        console.error(`Error parsing package.json at ${packageJsonPath}:`, err);
      }
    }
    
    // Strategy 2: Check for lock files
    if (fs.existsSync(path.join(packageDir, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    } else if (fs.existsSync(path.join(packageDir, 'yarn.lock'))) {
      return 'yarn';
    } else if (fs.existsSync(path.join(packageDir, 'package-lock.json'))) {
      return 'npm';
    }
    
    // Also check if there's a lockfile at the workspace root
    if (isRootPackage) {
      // This is already the root, we've checked above
      return 'npm';
    } else {
      // Check for root level lockfiles
      const workspacePath = workspaceRoot;
      
      if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
        return 'pnpm';
      } else if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
        return 'yarn';
      } else if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
        return 'npm';
      }
    }
    
    // Strategy 3: Fall back to npm
    return 'npm';
  } catch (err) {
    console.error(`Error detecting package manager for ${packageJsonPath}:`, err);
    return 'npm'; // Default fallback
  }
}

/**
 * Detects the root package manager for a workspace
 * Used to ensure consistent package manager use across nested packages
 *
 * @param workspacePath Root path of the workspace
 * @returns The detected package manager or undefined if not found
 */
export function detectRootPackageManager(workspacePath: string): PackageManager | undefined {
  try {
    if (fs.existsSync(path.join(workspacePath, 'pnpm-lock.yaml'))) {
      return 'pnpm';
    } else if (fs.existsSync(path.join(workspacePath, 'yarn.lock'))) {
      return 'yarn';
    } else if (fs.existsSync(path.join(workspacePath, 'package-lock.json'))) {
      return 'npm';
    }
    
    return undefined;
  } catch {
    return undefined;
  }
}
