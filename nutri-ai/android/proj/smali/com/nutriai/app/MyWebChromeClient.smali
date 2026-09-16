.class public Lcom/nutriai/app/MyWebChromeClient;
.super Landroid/webkit/WebChromeClient;
.source "MyWebChromeClient.java"

# instance fields
.field private final activityRef:Lcom/nutriai/app/MainActivity;


# direct methods
.method public constructor <init>(Lcom/nutriai/app/MainActivity;)V
    .locals 0

    invoke-direct {p0}, Landroid/webkit/WebChromeClient;-><init>()V

    iput-object p1, p0, Lcom/nutriai/app/MyWebChromeClient;->activityRef:Lcom/nutriai/app/MainActivity;

    return-void
.end method


# virtual methods
.method public onPermissionRequest(Landroid/webkit/PermissionRequest;)V
    .locals 3

    iget-object v0, p0, Lcom/nutriai/app/MyWebChromeClient;->activityRef:Lcom/nutriai/app/MainActivity;

    const-string v1, "android.permission.CAMERA"

    invoke-virtual {v0, v1}, Landroid/content/Context;->checkSelfPermission(Ljava/lang/String;)I

    move-result v0

    const/4 v1, 0x0

    if-eq v0, v1, :cond_0

    invoke-virtual {p1}, Landroid/webkit/PermissionRequest;->deny()V

    return-void

    :cond_0
    invoke-virtual {p1}, Landroid/webkit/PermissionRequest;->getResources()[Ljava/lang/String;

    move-result-object v2

    invoke-virtual {p1, v2}, Landroid/webkit/PermissionRequest;->grant([Ljava/lang/String;)V

    return-void
.end method


.method public onShowFileChooser(Landroid/webkit/WebView;Landroid/webkit/ValueCallback;Landroid/webkit/WebChromeClient$FileChooserParams;)Z
    .locals 3

    :try_start_0
    iget-object v0, p0, Lcom/nutriai/app/MyWebChromeClient;->activityRef:Lcom/nutriai/app/MainActivity;

    invoke-virtual {p3}, Landroid/webkit/WebChromeClient$FileChooserParams;->createIntent()Landroid/content/Intent;

    move-result-object v1

    invoke-virtual {v0, p2, v1}, Lcom/nutriai/app/MainActivity;->launchFilePicker(Landroid/webkit/ValueCallback;Landroid/content/Intent;)V

    const/4 v0, 0x1
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    return v0

    :catch_0
    move-exception v0

    const/4 v1, 0x0

    return v1
.end method
