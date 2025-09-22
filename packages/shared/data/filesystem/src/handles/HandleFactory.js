/**
 * HandleFactory - Factory for creating Handle instances without circular dependencies
 * 
 * This factory allows DirectoryHandle and FileHandle to create instances of each other
 * without circular import issues.
 */

let DirectoryHandleClass = null;
let FileHandleClass = null;

export class HandleFactory {
  static setDirectoryHandleClass(DirectoryHandle) {
    DirectoryHandleClass = DirectoryHandle;
  }
  
  static setFileHandleClass(FileHandle) {
    FileHandleClass = FileHandle;
  }
  
  static createDirectoryHandle(resourceManager, path) {
    if (!DirectoryHandleClass) {
      throw new Error('DirectoryHandle class not registered with HandleFactory');
    }
    return new DirectoryHandleClass(resourceManager, path);
  }
  
  static createFileHandle(resourceManager, path) {
    if (!FileHandleClass) {
      throw new Error('FileHandle class not registered with HandleFactory');
    }
    return new FileHandleClass(resourceManager, path);
  }
}