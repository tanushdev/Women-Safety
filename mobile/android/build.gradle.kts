allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}

subprojects {
    afterEvaluate {
        plugins.withId("com.android.library") {
            try {
                val lib = extensions.findByType(com.android.build.api.dsl.LibraryExtension::class.java)
                if (lib != null && (lib.compileSdk ?: 0) < 34) {
                    lib.compileSdk = 34
                }
            } catch (_: Exception) {
            }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
