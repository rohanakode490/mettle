const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const buildGradlePath = path.join(rootDir, 'android', 'build.gradle');
const gradlePropertiesPath = path.join(rootDir, 'android', 'gradle.properties');

// 1. Update android/build.gradle
if (fs.existsSync(buildGradlePath)) {
  let content = fs.readFileSync(buildGradlePath, 'utf8');
  if (!content.includes('minSdkVersion = Integer.parseInt')) {
    const extBlock = `buildscript {
  ext {
    buildToolsVersion = findProperty('android.buildToolsVersion') ?: '35.0.0'
    minSdkVersion = Integer.parseInt(findProperty('android.minSdkVersion') ?: '24')
    compileSdkVersion = Integer.parseInt(findProperty('android.compileSdkVersion') ?: '36')
    targetSdkVersion = Integer.parseInt(findProperty('android.targetSdkVersion') ?: '35')
    kotlinVersion = findProperty('android.kotlinVersion') ?: '2.1.20'
  }
`;
    content = content.replace('buildscript {', extBlock);
    fs.writeFileSync(buildGradlePath, content, 'utf8');
    console.log('Patched android/build.gradle successfully.');
  }
}

// 2. Update android/gradle.properties
if (fs.existsSync(gradlePropertiesPath)) {
  let props = fs.readFileSync(gradlePropertiesPath, 'utf8');
  props = props.replace(/org\.gradle\.jvmargs=.*/g, 'org.gradle.jvmargs=-Xmx4096m -XX:MaxMetaspaceSize=1024m');
  props = props.replace(/android\.compileSdkVersion=.*/g, 'android.compileSdkVersion=36');
  if (!props.includes('android.compileSdkVersion=36')) {
    props += '\nandroid.compileSdkVersion=36\n';
  }
  if (!props.includes('android.minSdkVersion=24')) {
    props += '\nandroid.minSdkVersion=24\n';
  }
  fs.writeFileSync(gradlePropertiesPath, props, 'utf8');
  console.log('Patched android/gradle.properties successfully.');
}
