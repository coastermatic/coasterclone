// declare anonymous scope with dependencies: jQuery, Shopify, window
(function($, Shopify, window) {
  // globals
  // cropped dimensions
  var DIAMETER = 640;
  var PREVIEW_DIAMETER = 320;

  // photo-upload, set of 4
  var PRODUCT_VARIANT = 7432867779;

  // setup event handlers, controller scope
  $(document).ready(function() {
    var images = [];
    var tray = [];

    $("#choose-photo").click(function(e) { $("#file-input").val("").click(); });
    $("#file-input").change(function(e) {
      $(".internal-container").show();
      $(".loading").show();
      var resolve = 0;
      for(var i = 0, len = this.files.length; i < len; i++) {
        readImage(this.files[i], function(img) {
          tray.push(img);
          if(images.length < 4) { 
            images.unshift(img);
          }
          if(++resolve == len) {
            // only render once all files have been read (resolved)
            renderTray(tray, images);
            renderShortlist(images);
            $(".loading").hide();
          }
        });
      }
    });

    $("#save-crop").click(function(e) {
      var $img = $("#crop-view > img");
      var cropdata = $img.cropper("getData", true);
      var img = images[$img.data("index")];
      img.x = cropdata.x;
      img.y = cropdata.y;
      img.w = cropdata.width;
      img.h = cropdata.height;
      renderShortlist(images);
      $("#overlay").hide();
    });

    $("#cancel-crop").click(function(e) { $("#overlay").hide(); });

    $("#shortlist").on("click", "a.crop", function (e) {
      e.preventDefault();
      var index = $(this).parent().data("index");
      var img = images[index];
      $("#overlay").show();

      // setup the cropper after the UI has updated (to prevent rendering problems)
      setTimeout(function() {
        // reset cropper and slider
        var $cropview = $("#crop-view > img");
        $cropview.cropper("destroy");
        $cropview.data("index", index).attr("src", img.url);
        $cropview.cropper({
          aspectRatio: 1,
          autoCropArea: 1,
          wheelZoomRatio: 0.01,
          scalable: false,
          guides: false,
          highlight: false,
          center: false,
          background: false,
          dragCrop: false,
          cropBoxMovable: false,
          cropBoxResizable: false
        });
        $cropview.cropper("setCanvasData", { "left": 0, "top": 0, "width": PREVIEW_DIAMETER, "height": PREVIEW_DIAMETER });
        $cropview.cropper("setCropBoxData", { "left": 0, "top": 0, "width": PREVIEW_DIAMETER, "height": PREVIEW_DIAMETER });
        
        var slider = document.getElementById("crop-slider");
        if(slider.noUiSlider) { slider.noUiSlider.destroy(); }
        noUiSlider.create(slider, {
          "start": PREVIEW_DIAMETER,
          "range": { "min": PREVIEW_DIAMETER, "max": PREVIEW_DIAMETER / DIAMETER * Math.max(img.width, img.height) }
        });
        slider.noUiSlider.on("set", function(vals){
          var val = Number(vals[0]);
          console.log(val, typeof val);
          $("#crop-view > img").cropper("setCanvasData", { "left": 0, "top": 0, "width": 0+val, "height": 0+val});
          console.log($("#crop-view > img").cropper("getCanvasData"));
        });
      }, 0);
    });

    $("#shortlist").on("click", "a.remove-link", function (e) {
      e.preventDefault();
      images.splice($(this).parent().data("index"),1);
      renderShortlist(images);
      renderTray(tray, images);
    });

    $("#images").on("click", "li", function(e) {
      var index = $(this).data("index");
      var img = tray[index];
      if(images.length < 4) {
        images.unshift(img);
        renderShortlist(images);
        renderTray(tray, images);
      }
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
      formdata.append("properties[_img_" + (i+1) + "_url]", img.cropped);
      formdata.append("properties[_img_" + (i+1) + "_thumbnail]", img.thumbnail);
    });

    var xhr = new XMLHttpRequest();
    xhr.addEventListener("load", function(e) { console.log("load", e); loadCart(); }, false);
    xhr.addEventListener("error", function(e) { console.log("error", e); Shopify.onError(xhr, "failed"); }, false);
    xhr.addEventListener("abort", function(e) { console.log("abort", e); Shopify.onError(xhr, "aborted"); }, false);
    xhr.open("POST", "/cart/add");
    xhr.send(formdata);
  };

  // Controllers:
  function readImage(file, callback) {
    var reader = new FileReader();
    reader.onload = function (event) {
      // resize original to a memory-friendly size
      resizeImage(event.target.result, 2*DIAMETER, 2*DIAMETER, "cover", callback);
    };
    reader.readAsDataURL(file);
  }

  function resetImages() {
    $("#shortlist li").css("background-image","").addClass("empty").find("a").hide();
  }

  function renderTray(tray, images) {
    $(".internal-container").toggle(tray.length > 0);
    var $ul = $("<ul>").appendTo($("#images").empty());
    tray.forEach(function(img, i) {
      $('<li data-index="' + i + '">').toggleClass("shortlisted", images.indexOf(img) > -1).css({ 
        "background-image": "url(" + img.url + ")",
        "background-size": "cover"
      }).appendTo($ul);
    });
  }
  
  function renderShortlist(images) {
    // reset
    resetImages();

    // resize and crop to square
    images.forEach(function(img, i) {
      // thumbWH is the preview thumbnail size
      var thumbWH = 230;
      squarifyImage(img, thumbWH, function(squarified) {
        // render the image preview
        img.thumbnail = dataURLtoBlob(squarified.url);
        $("#shortlist li." + i).removeClass("empty").data("index", i)
        .css("background-image", "url(" + squarified.url + ")").find("a").show();
      });

      // process image (inclusive of user-cropped data), resize and crop based on max dimension
      squarifyImage(img, DIAMETER, function(squarified) {
        img.cropped = dataURLtoBlob(squarified.url);
      });
    });

    // conditional rendering stuff
    var message = "Select <span>" + (4 - images.length) + "</span> Images";
    var midSelection = images.length > 0 && images.length < 4;
    $("#msg-border").toggle(images.length === 0);
    $("#choose-photo").toggle(images.length < 4);
    $("h1#select-image-count").html(message).toggleClass("select-image-count-mid-selection", midSelection).toggle(images.length < 4);
    if(images.length == 4) {
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
      var c = newCanvasContext(cW, cH);
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
