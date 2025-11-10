Why this file exists

The local Gradle build failed during `settings.gradle` evaluation because the Kotlin/Gradle tooling attempted to parse the Java version and choked on Java 25.

Quick summary

- Gradle/Kotlin tooling used by the React Native plugin is not guaranteed to support very new JDK release strings (e.g. `25.0.1`).
- Use JDK 17 (LTS) for this project to avoid parsing/compatibility problems.

Options

1) Temporary (per-terminal) — fastest

Open PowerShell and run (replace the JDK path):

```powershell
$env:JAVA_HOME = 'C:\\path\\to\\jdk-17'
$env:PATH = "$env:JAVA_HOME\\bin;" + $env:PATH
cd 'e:\\Users\\Fernando\\Ambiente de Trabalho\\Projetos\\nuti\\mobile\\android'
.\gradlew.bat assembleDebug --no-daemon --stacktrace
```

2) Project-level (persist for this project only)

Edit `gradle.properties` and set `org.gradle.java.home` to the path of a JDK 17 installation. Example (Windows):

```
org.gradle.java.home=C:\\Program Files\\Java\\jdk-17
```

(We added a commented example already in `gradle.properties`.)

3) If you don't have JDK 17 installed

- Download Temurin (Adoptium) JDK 17 for Windows x64: https://adoptium.net
- Install it, then use option (1) or (2) above.

Next steps after Java fix

- Re-run Gradle (`assembleDebug`) and paste the output if errors persist.
- If the build proceeds, we'll remove any temporary Kotlin stubs created and let the expo autolinking/plugin flow generate correct interfaces.

If you'd like, I can:
- Patch `gradle.properties` to set `org.gradle.java.home` (I need the exact JDK17 path), or
- Run a little PowerShell helper script (below) if you provide the JDK path.

PowerShell helper (optional)

There's also a small script `run-gradle-with-jdk17.ps1` you can use that asks for a JDK path and runs Gradle; see that file next to this README.

