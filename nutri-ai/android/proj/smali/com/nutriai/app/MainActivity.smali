.class public Lcom/nutriai/app/MainActivity;
.super Landroid/app/Activity;
.source "MainActivity.java"

# instance fields
.field private pendingFileCallback:Landroid/webkit/ValueCallback;
.field private webView:Landroid/webkit/WebView;


# direct methods
.method public constructor <init>()V
    .locals 0

    invoke-direct {p0}, Landroid/app/Activity;-><init>()V

    return-void
.end method


# virtual methods
.method public launchFilePicker(Landroid/webkit/ValueCallback;Landroid/content/Intent;)V
    .locals 2

    iput-object p1, p0, Lcom/nutriai/app/MainActivity;->pendingFileCallback:Landroid/webkit/ValueCallback;

    :try_start_0
    const/16 v0, 0x3e9

    invoke-virtual {p0, p2, v0}, Lcom/nutriai/app/MainActivity;->startActivityForResult(Landroid/content/Intent;I)V
    :try_end_0
    .catch Ljava/lang/Exception; {:try_start_0 .. :try_end_0} :catch_0

    return-void

    :catch_0
    move-exception v0

    const/4 v1, 0x0

    invoke-interface {p1, v1}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    const/4 v1, 0x0

    iput-object v1, p0, Lcom/nutriai/app/MainActivity;->pendingFileCallback:Landroid/webkit/ValueCallback;

    return-void
.end method


.method public onBackPressed()V
    .locals 1

    iget-object v0, p0, Lcom/nutriai/app/MainActivity;->webView:Landroid/webkit/WebView;

    if-eqz v0, :cond_0

    invoke-virtual {v0}, Landroid/webkit/WebView;->canGoBack()Z

    move-result v0

    if-eqz v0, :cond_0

    iget-object v0, p0, Lcom/nutriai/app/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->goBack()V

    return-void

    :cond_0
    invoke-super {p0}, Landroid/app/Activity;->onBackPressed()V

    return-void
.end method


.method protected onCreate(Landroid/os/Bundle;)V
    .locals 4

    invoke-super {p0, p1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V

    new-instance v0, Landroid/webkit/WebView;

    invoke-direct {v0, p0}, Landroid/webkit/WebView;-><init>(Landroid/content/Context;)V

    iput-object v0, p0, Lcom/nutriai/app/MainActivity;->webView:Landroid/webkit/WebView;

    invoke-virtual {v0}, Landroid/webkit/WebView;->getSettings()Landroid/webkit/WebSettings;

    move-result-object v1

    const/4 v2, 0x1

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setJavaScriptEnabled(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setDomStorageEnabled(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowFileAccess(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setAllowContentAccess(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setMediaPlaybackRequiresUserGesture(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setLoadWithOverviewMode(Z)V

    invoke-virtual {v1, v2}, Landroid/webkit/WebSettings;->setUseWideViewPort(Z)V

    new-instance v1, Lcom/nutriai/app/MyWebViewClient;

    invoke-direct {v1}, Lcom/nutriai/app/MyWebViewClient;-><init>()V

    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebViewClient(Landroid/webkit/WebViewClient;)V

    new-instance v1, Lcom/nutriai/app/MyWebChromeClient;

    invoke-direct {v1, p0}, Lcom/nutriai/app/MyWebChromeClient;-><init>(Lcom/nutriai/app/MainActivity;)V

    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->setWebChromeClient(Landroid/webkit/WebChromeClient;)V

    invoke-virtual {p0, v0}, Lcom/nutriai/app/MainActivity;->setContentView(Landroid/view/View;)V

    const-string v1, "android.permission.CAMERA"

    invoke-virtual {p0, v1}, Landroid/content/Context;->checkSelfPermission(Ljava/lang/String;)I

    move-result v2

    const/4 v3, -0x1

    if-ne v2, v3, :cond_1

    const/4 v2, 0x1

    new-array v2, v2, [Ljava/lang/String;

    const/4 v3, 0x0

    const-string v1, "android.permission.CAMERA"

    aput-object v1, v2, v3

    const/16 v3, 0x29

    invoke-virtual {p0, v2, v3}, Lcom/nutriai/app/MainActivity;->requestPermissions([Ljava/lang/String;I)V

    :cond_1
    const-string v1, "file:///android_asset/www/index.html"

    invoke-virtual {v0, v1}, Landroid/webkit/WebView;->loadUrl(Ljava/lang/String;)V

    return-void
.end method


.method protected onActivityResult(IILandroid/content/Intent;)V
    .locals 4

    invoke-super {p0, p1, p2, p3}, Landroid/app/Activity;->onActivityResult(IILandroid/content/Intent;)V

    const/16 v0, 0x3e9

    if-eq p1, v0, :cond_0

    return-void

    :cond_0
    const/4 v0, 0x0

    const/4 v1, -0x1

    if-ne p2, v1, :cond_2

    if-eqz p3, :cond_2

    invoke-virtual {p3}, Landroid/content/Intent;->getData()Landroid/net/Uri;

    move-result-object v1

    if-eqz v1, :cond_2

    const/4 v2, 0x1

    new-array v2, v2, [Landroid/net/Uri;

    const/4 v3, 0x0

    aput-object v1, v2, v3

    move-object v0, v2

    :cond_2
    iget-object v1, p0, Lcom/nutriai/app/MainActivity;->pendingFileCallback:Landroid/webkit/ValueCallback;

    if-eqz v1, :cond_3

    invoke-interface {v1, v0}, Landroid/webkit/ValueCallback;->onReceiveValue(Ljava/lang/Object;)V

    const/4 v1, 0x0

    iput-object v1, p0, Lcom/nutriai/app/MainActivity;->pendingFileCallback:Landroid/webkit/ValueCallback;

    :cond_3
    return-void
.end method
