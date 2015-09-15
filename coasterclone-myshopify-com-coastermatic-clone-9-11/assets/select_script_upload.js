// declare anonymous scope with dependencies: jQuery, Shopify, window
(function($, Shopify, window) {
  // setup event handlers, controller scope
  $(document).ready(function() {
    // photo-upload, set of 4
    var PRODUCT_VARIANT = 7432867779;
    var images = [];

    $("#choose-photo").click(function(e) { $("#file-input").val("").click(); });
    $("#file-input").change(function(e) { if(this.files.length) { addImage(images, this.files[0]); } });

    $("#crop-view > img").cropper({
      "aspectRatio": 1,
      "rotatable": false,
      "scalable": false,
    });

    $("#save-crop").click(function(e) {
      var $img = $("#crop-view > img");
      var cropdata = $img.cropper("getData", true);
      var img = images[$img.data("index")];
      img.x = cropdata.x;
      img.y = cropdata.y;
      img.w = cropdata.width;
      img.h = cropdata.height;
      renderImages(images);
      $("#overlay").hide();
    });

    $("#cancel-crop").click(function(e) { $("#overlay").hide(); });

    $("#shortlist").on("click", "a.crop", function (e) {
      e.preventDefault();
      var index = $(this).parent().data("index");
      $("#crop-view > img").data("index", index).cropper("replace", images[index].url);
      $("#overlay").show();
    });

    $("#shortlist").on("click", "a.remove-link", function (e) {
      e.preventDefault();
      images.splice($(this).parent().data("index"),1);
      renderImages(images);
    });

    $("a#add-to-cart").on("click", function (e) {
      e.preventDefault();
      Shopify.addItem(PRODUCT_VARIANT, 1, images);
    });

    resetImages();
  });

  // Shopify hooks
  Shopify.addItem = function (product_variant, quantity, images) {
    var formdata = new FormData();
    formdata.append("id", product_variant);
    formdata.append("quantity", quantity);
    images.forEach(function(img, i) {
      formdata.append("properties[img_" + (i+1) + "_url]", img.cropped);
      formdata.append("properties[img_" + (i+1) + "_thumbnail]", img.thumbnail);
    });

    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function(e) { console.log("load", e); loadCart(); }, false);
    xhr.addEventListener("error", function(e) { console.log("error", e); Shopify.onError(xhr, "failed"); }, false);
    xhr.addEventListener("abort", function(e) { console.log("abort", e); Shopify.onError(xhr, "aborted"); }, false);
    xhr.open("POST", "/cart/add");
    xhr.send(formdata);
  };

  // Controllers:
  // File handler, update model
  function addImage(previews, file) {
    var reader = new FileReader();
    reader.onload = function (event) {
      // resize original to a memory-friendly size
      resizeImage(event.target.result, 2*1080, 2*1080, "cover", function(img) {
        previews.unshift(img);
        renderImages(previews);
      });
    };
    reader.readAsDataURL(file);
  }

  function resetImages() {
    $("#shortlist li").css("background-image","").addClass("empty").find("a").hide();
  }

  // renderer
  function renderImages(previews) {
    // reset
    resetImages();

    // resize and crop to square
    previews.forEach(function(img, i) {
      // thumbWH is the preview thumbnail size
      var thumbWH = 230;
      squarifyImage(img, thumbWH, function(squarified) {
        // render the image preview
        img.thumbnail = dataURLtoBlob(squarified.url);
        $("#shortlist li." + i).removeClass("empty").data("index", i).css("background-image", "url(" + squarified.url + ")").find("a").show();
      });

      // process image (inclusive of user-cropped data), resize and crop based on 1080 max dimension
      var WH = 1080;
      squarifyImage(img, WH, function(squarified) {
        img.cropped = dataURLtoBlob(squarified.url);
      });
    });

    // other rendering stuff
    var message = "Select <span>" + (4 - previews.length) + "</span> Images";
    var midSelection = previews.length > 0 && previews.length < 4;
    $("#msg-border").toggle(previews.length === 0);
    $("#choose-photo").toggle(previews.length < 4);
    $("h1#select-image-count").html(message).toggleClass("select-image-count-mid-selection", midSelection).toggle(previews.length < 4);
    if(previews.length == 4) {
      $("#add-to-cart").fadeIn();
      $(".sticky-wrapper").height(330);
    } else {
      $("#add-to-cart").fadeOut();
      $(".sticky-wrapper").height(270);
    }
  }

  // Utility to squarify and apply user-defined cropping
  function squarifyImage(img, wh, callback) {
    resizeImage(img.url, wh, wh, "cover", function(resized) {
      var scaleFactor = resized.width / resized.naturalWidth;
      var cX = Math.round((img.x*scaleFactor) || Math.max(0, (wh - resized.width) / 2));
      var cY = Math.round((img.y*scaleFactor) || Math.max(0, (wh - resized.height) / 2));
      var cW = Math.round((img.w*scaleFactor) || Math.min(resized.width, wh));
      var cH = Math.round((img.h*scaleFactor) || Math.min(resized.height, wh));
      cropImage(resized.url, cX, cY, cW, cH, callback);
    });
  }

  function loadCart(){
    window.location = document.getElementById("shop-url").innerHTML + "/cart";
  }

  // Image manipulation functions
  // Utility to create a canvas element
  function newCanvasContext(w,h) {
    var canvas = document.createElement("CANVAS");
    canvas.width = w;
    canvas.height = h;
    return canvas.getContext("2d");
  }

  // Downsamples the input such that the result will either "cover" or "contain" the desired width / height,
  // (either width or height may be larger than desired, but the other dimension will be an exact fit)
  // and returns a JPEG
  function resizeImage(dataURL, w, h, mode, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      var downsample = Math[mode == "cover" ? "min" : "max"](this.naturalWidth / w, this.naturalHeight / h);
      var cW = Math.round(this.naturalWidth / downsample);
      var cH = Math.round(this.naturalHeight / downsample);
      var c = newCanvasContext(w, h);
      c.drawImage(this, 0, 0, cW, cH);
      callback({
        "naturalWidth": this.naturalWidth,
        "naturalHeight": this.naturalHeight,
        "width": cW,
        "height": cH,
        "url": c.canvas.toDataURL("image/jpeg")
      });
    };
    tmp.src = dataURL;
  }

  // Crop rectangle defined by (x, y), (x+w, y+h).
  function cropImage(dataURL, x, y, w, h, callback) {
    var tmp = new Image();
    tmp.onload = function() {
      var c = newCanvasContext(w, h);
      c.drawImage(this, x, y, w, h, 0, 0, w, h);
      callback({ "width": w, "height": h, "url": c.canvas.toDataURL("image/jpeg") });
    };
    tmp.src = dataURL;
  }

  // Convert datURL back to File blob for upload
  function dataURLtoBlob(dataURL) {
    var binary = atob(dataURL.split(',')[1]);
    var array = [];
    for(var i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
    }
    return new Blob([new Uint8Array(array)], {"type": "image/jpeg"});
  }

})($, Shopify, window);
